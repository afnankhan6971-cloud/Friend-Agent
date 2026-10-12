"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../services/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get('/', async (req, res) => {
    const token = req.token;
    const authClient = (0, db_1.getAuthClient)(token);
    if (!authClient)
        return res.json([]);
    const userId = req.user.id;
    const { data, error } = await authClient
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
router.post('/', async (req, res) => {
    const token = req.token;
    const authClient = (0, db_1.getAuthClient)(token);
    if (!authClient)
        return res.json({ success: true, mock: true });
    const userId = req.user.id;
    const { memory, category, importance } = req.body;
    const { data, error } = await authClient
        .from('memories')
        .insert({ user_id: userId, memory, category, importance })
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
router.put('/:id', async (req, res) => {
    const token = req.token;
    const authClient = (0, db_1.getAuthClient)(token);
    if (!authClient)
        return res.status(500).json({ error: 'DB client missing' });
    const userId = req.user.id;
    const { id } = req.params;
    const { memory } = req.body;
    const { data, error } = await authClient
        .from('memories')
        .update({ memory })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
router.delete('/:id', async (req, res) => {
    const token = req.token;
    const authClient = (0, db_1.getAuthClient)(token);
    if (!authClient)
        return res.status(500).json({ error: 'DB client missing' });
    const userId = req.user.id;
    const { id } = req.params;
    const { error } = await authClient
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: error.message });
    res.json({ success: true });
});
router.delete('/', async (req, res) => {
    const token = req.token;
    const authClient = (0, db_1.getAuthClient)(token);
    if (!authClient)
        return res.status(500).json({ error: 'DB client missing' });
    const userId = req.user.id;
    const { error } = await authClient
        .from('memories')
        .delete()
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: error.message });
    res.json({ success: true });
});
exports.default = router;
