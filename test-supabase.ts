import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('conversations').select('*').limit(1);
  if (error) {
    console.error("Error querying conversations:", error.message);
    process.exit(1);
  }
  console.log("Successfully connected and queried conversations table. Data:", data);
}
test();
