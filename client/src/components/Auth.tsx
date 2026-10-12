import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Signup successful! You can now log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 font-sans text-foreground">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface-1 rounded-[24px] shadow-lg border border-border p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
        
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-surface-2 border border-border rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Sparkles size={32} className="text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-heading mb-2 tracking-tight">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-muted-foreground">
            {isLogin ? 'Sign in to access your companion' : 'Sign up to get started'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 rounded-xl text-red-800 text-sm font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-100 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3.5 rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-medium text-muted-foreground hover:text-primary dark:hover:text-foreground transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
