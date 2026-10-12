const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.auth.signInAnonymously();
  console.log("Anon Data:", data);
  console.log("Anon Error:", error);
}
run();
