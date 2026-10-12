import { Request, Response, NextFunction } from 'express';
import { supabase } from '../services/db';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.replace('Bearer ', '');
  if (!supabase) {
    return res.status(500).json({ error: "Supabase client not initialized" });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  (req as any).user = user;
  (req as any).token = token;
  next();
};
