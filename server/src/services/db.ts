import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// A mock client if keys are not provided yet to avoid crashing the dev server
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Creates a client authenticated as the user using their JWT
export const getAuthClient = (jwt: string) => {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
};

if (!supabase) {
  console.warn("⚠️ SUPABASE_URL and SUPABASE_ANON_KEY are not set. Database features will fail.");
}
