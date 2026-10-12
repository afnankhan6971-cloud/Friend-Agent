"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const db_1 = require("../services/db");
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: "Missing authorization header" });
    }
    const token = authHeader.replace('Bearer ', '');
    if (!db_1.supabase) {
        return res.status(500).json({ error: "Supabase client not initialized" });
    }
    const { data: { user }, error } = await db_1.supabase.auth.getUser(token);
    if (error || !user) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    req.token = token;
    next();
};
exports.requireAuth = requireAuth;
