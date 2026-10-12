import { Router } from 'express';
import { supabase, getAuthClient } from '../services/db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const token = (req as any).token;
  const userDb = getAuthClient(token) || supabase;
  
  if (!userDb) return res.json([]);
  
  const userId = (req as any).user.id;
  const { data, error } = await userDb
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const token = (req as any).token;
  const userDb = getAuthClient(token) || supabase;

  if (!userDb) {
    return res.json({ id: 'mock-conv-id', title: 'Mock Conversation' });
  }

  const userId = (req as any).user.id;
  const { title } = req.body;
  const { data, error } = await userDb
    .from('conversations')
    .insert({ user_id: userId, title: title || 'New Chat' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/search', async (req, res) => {
  const token = (req as any).token;
  const userDb = getAuthClient(token) || supabase;
  
  if (!userDb) return res.json({ conversations: [] });
  
  const userId = (req as any).user.id;
  const q = req.query.q as string;
  
  if (!q || q.trim() === '') {
    return res.json({ conversations: [] });
  }

  const query = q.trim();

  try {
    const { data: titleData, error: titleErr } = await userDb
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .ilike('title', `%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (titleErr) throw titleErr;

    const { data: userConvs, error: convsErr } = await userDb
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (convsErr) throw convsErr;
    
    const convMap = new Map();
    userConvs?.forEach((c: any) => convMap.set(c.id, c));
    const convIds = Array.from(convMap.keys());

    let messageData: any[] = [];
    if (convIds.length > 0) {
      const { data: mData, error: mErr } = await userDb
        .from('messages')
        .select('conversation_id, content')
        .in('conversation_id', convIds)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false });
        
      if (mErr) throw mErr;
      if (mData) messageData = mData;
    }

    const resultsMap = new Map();

    titleData?.forEach((conv: any) => {
      resultsMap.set(conv.id, {
        id: conv.id,
        title: conv.title,
        updated_at: conv.updated_at,
        matchedMessageSnippet: null,
        matchType: 'title'
      });
    });

    messageData?.forEach((msg: any) => {
      const convId = msg.conversation_id;
      const conv = convMap.get(convId);
      if (!conv) return;

      const existing = resultsMap.get(convId);
      const content = msg.content || '';
      const matchIndex = content.toLowerCase().indexOf(query.toLowerCase());
      let snippet = content;
      if (matchIndex > -1) {
        const start = Math.max(0, matchIndex - 20);
        const end = Math.min(content.length, matchIndex + query.length + 20);
        snippet = (start > 0 ? '...' : '') + content.substring(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '');
      } else {
         snippet = content.substring(0, 40) + '...';
      }

      if (existing) {
        if (existing.matchType === 'title') {
          existing.matchType = 'both';
          existing.matchedMessageSnippet = snippet;
        }
      } else {
        resultsMap.set(convId, {
          id: conv.id,
          title: conv.title,
          updated_at: conv.updated_at,
          matchedMessageSnippet: snippet,
          matchType: 'message'
        });
      }
    });

    const results = Array.from(resultsMap.values());
    results.sort((a: any, b: any) => {
      const typeScore = (type: string) => type === 'both' ? 3 : type === 'title' ? 2 : 1;
      const scoreDiff = typeScore(b.matchType) - typeScore(a.matchType);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    res.json({ conversations: results.slice(0, 20) });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  const token = (req as any).token;
  const userDb = getAuthClient(token) || supabase;

  if (!userDb) return res.json([]);
  
  const userId = (req as any).user.id;
  
  // Verify conversation ownership first
  const { data: convData } = await userDb
    .from('conversations')
    .select('user_id')
    .eq('id', req.params.id)
    .single();
    
  if (!convData || convData.user_id !== userId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  const { data, error } = await userDb
    .from('messages')
    .select('*, attachments(*)')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Resolve signed URLs for attachments
  const { getImageUrl } = await import('../services/storage');
  const messagesWithUrls = await Promise.all((data || []).map(async (msg: any) => {
    let imageUrl: string | undefined;
    let originalImageUrl: string | undefined;

    if (msg.attachments && msg.attachments.length > 0) {
      const attsWithUrls = await Promise.all(msg.attachments.map(async (att: any) => {
        const url = await getImageUrl(userDb, att.file_path);
        return { ...att, url };
      }));
      msg.attachments = attsWithUrls;

      // Check if this was an edit result with both generated and original images
      const generatedAtt = attsWithUrls.find((a: any) => a.file_path.includes('generated_') || a.file_path.includes('edited_'));
      const uploadAtt = attsWithUrls.find((a: any) => a.file_path.includes('upload_'));

      if (generatedAtt && uploadAtt) {
        imageUrl = generatedAtt.url || undefined;
        originalImageUrl = uploadAtt.url || undefined;
      } else if (attsWithUrls[0]?.url) {
        imageUrl = attsWithUrls[0].url;
      }
    }

    return {
      ...msg,
      imageUrl,
      originalImageUrl
    };
  }));

  res.json(messagesWithUrls);
});

router.put('/:id', async (req, res) => {
  const token = (req as any).token;
  const userDb = getAuthClient(token) || supabase;
  if (!userDb) return res.status(401).json({ error: 'Unauthorized' });
  
  const userId = (req as any).user.id;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const { data, error } = await userDb
    .from('conversations')
    .update({ title })
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
