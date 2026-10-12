import { Router } from 'express';
import { getAuthClient } from '../services/db';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const token = (req as any).token;
  const authClient = getAuthClient(token);
  if (!authClient) return res.json([]);
  
  const userId = (req as any).user.id;
  const { data, error } = await authClient
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const token = (req as any).token;
  const authClient = getAuthClient(token);
  if (!authClient) return res.json({ success: true, mock: true });
  
  const userId = (req as any).user.id;
  const { memory, category, importance } = req.body;
  
  const { data, error } = await authClient
    .from('memories')
    .insert({ user_id: userId, memory, category, importance })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const token = (req as any).token;
  const authClient = getAuthClient(token);
  if (!authClient) return res.status(500).json({ error: 'DB client missing' });

  const userId = (req as any).user.id;
  const { id } = req.params;
  const { memory } = req.body;

  const { data, error } = await authClient
    .from('memories')
    .update({ memory })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const token = (req as any).token;
  const authClient = getAuthClient(token);
  if (!authClient) return res.status(500).json({ error: 'DB client missing' });

  const userId = (req as any).user.id;
  const { id } = req.params;

  const { error } = await authClient
    .from('memories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.delete('/', async (req, res) => {
  const token = (req as any).token;
  const authClient = getAuthClient(token);
  if (!authClient) return res.status(500).json({ error: 'DB client missing' });

  const userId = (req as any).user.id;

  const { error } = await authClient
    .from('memories')
    .delete()
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
