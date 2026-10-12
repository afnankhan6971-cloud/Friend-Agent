"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../services/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/', async (req, res) => {
    const token = req.token;
    const userDb = (0, db_1.getAuthClient)(token) || db_1.supabase;
    if (!userDb)
        return res.json([]);
    const userId = req.user.id;
    const { data, error } = await userDb
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
router.post('/', async (req, res) => {
    const token = req.token;
    const userDb = (0, db_1.getAuthClient)(token) || db_1.supabase;
    if (!userDb) {
        return res.json({ id: 'mock-conv-id', title: 'Mock Conversation' });
    }
    const userId = req.user.id;
    const { title } = req.body;
    const { data, error } = await userDb
        .from('conversations')
        .insert({ user_id: userId, title: title || 'New Chat' })
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
router.get('/search', async (req, res) => {
    const token = req.token;
    const userDb = (0, db_1.getAuthClient)(token) || db_1.supabase;
    if (!userDb)
        return res.json({ conversations: [] });
    const userId = req.user.id;
    const q = req.query.q;
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
        if (titleErr)
            throw titleErr;
        const { data: userConvs, error: convsErr } = await userDb
            .from('conversations')
            .select('id, title, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });
        if (convsErr)
            throw convsErr;
        const convMap = new Map();
        userConvs?.forEach((c) => convMap.set(c.id, c));
        const convIds = Array.from(convMap.keys());
        let messageData = [];
        if (convIds.length > 0) {
            const { data: mData, error: mErr } = await userDb
                .from('messages')
                .select('conversation_id, content')
                .in('conversation_id', convIds)
                .ilike('content', `%${query}%`)
                .order('created_at', { ascending: false });
            if (mErr)
                throw mErr;
            if (mData)
                messageData = mData;
        }
        const resultsMap = new Map();
        titleData?.forEach((conv) => {
            resultsMap.set(conv.id, {
                id: conv.id,
                title: conv.title,
                updated_at: conv.updated_at,
                matchedMessageSnippet: null,
                matchType: 'title'
            });
        });
        messageData?.forEach((msg) => {
            const convId = msg.conversation_id;
            const conv = convMap.get(convId);
            if (!conv)
                return;
            const existing = resultsMap.get(convId);
            const content = msg.content || '';
            const matchIndex = content.toLowerCase().indexOf(query.toLowerCase());
            let snippet = content;
            if (matchIndex > -1) {
                const start = Math.max(0, matchIndex - 20);
                const end = Math.min(content.length, matchIndex + query.length + 20);
                snippet = (start > 0 ? '...' : '') + content.substring(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '');
            }
            else {
                snippet = content.substring(0, 40) + '...';
            }
            if (existing) {
                if (existing.matchType === 'title') {
                    existing.matchType = 'both';
                    existing.matchedMessageSnippet = snippet;
                }
            }
            else {
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
        results.sort((a, b) => {
            const typeScore = (type) => type === 'both' ? 3 : type === 'title' ? 2 : 1;
            const scoreDiff = typeScore(b.matchType) - typeScore(a.matchType);
            if (scoreDiff !== 0)
                return scoreDiff;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        res.json({ conversations: results.slice(0, 20) });
    }
    catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    const token = req.token;
    const userDb = (0, db_1.getAuthClient)(token) || db_1.supabase;
    if (!userDb)
        return res.json([]);
    const userId = req.user.id;
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
    if (error)
        return res.status(500).json({ error: error.message });
    // Resolve signed URLs for attachments
    const { getImageUrl } = await Promise.resolve().then(() => __importStar(require('../services/storage')));
    const messagesWithUrls = await Promise.all((data || []).map(async (msg) => {
        let imageUrl;
        let originalImageUrl;
        if (msg.attachments && msg.attachments.length > 0) {
            const attsWithUrls = await Promise.all(msg.attachments.map(async (att) => {
                const url = await getImageUrl(userDb, att.file_path);
                return { ...att, url };
            }));
            msg.attachments = attsWithUrls;
            // Check if this was an edit result with both generated and original images
            const generatedAtt = attsWithUrls.find((a) => a.file_path.includes('generated_') || a.file_path.includes('edited_'));
            const uploadAtt = attsWithUrls.find((a) => a.file_path.includes('upload_'));
            if (generatedAtt && uploadAtt) {
                imageUrl = generatedAtt.url || undefined;
                originalImageUrl = uploadAtt.url || undefined;
            }
            else if (attsWithUrls[0]?.url) {
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
    const token = req.token;
    const userDb = (0, db_1.getAuthClient)(token) || db_1.supabase;
    if (!userDb)
        return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;
    const { title } = req.body;
    if (!title)
        return res.status(400).json({ error: 'Title is required' });
    const { data, error } = await userDb
        .from('conversations')
        .update({ title })
        .eq('id', req.params.id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
exports.default = router;
