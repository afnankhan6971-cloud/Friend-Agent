const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.auth.signUp({
    email: `test_${Date.now()}@gmail.com`,
    password: "Password123!"
  });
  console.log("Data:", data);
  console.log("Error:", error);
}
run();
