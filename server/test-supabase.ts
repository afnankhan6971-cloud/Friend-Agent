import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url!, key!);

async function test() {
  const email = `mockuser123@gmail.com`;
  const password = 'mockpassword123';
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    process.exit(1);
  }

  console.log("Signed up user:", authData.user?.id);
  
  if (authData.user?.id) {
    const { data, error } = await supabase.from('conversations').insert({
      user_id: authData.user.id,
      title: 'Test RLS with Auth'
    }).select();

    if (error) {
      console.error("Error inserting:", error.message);
    } else {
      console.log("Inserted:", data);
    }
  }
}
test();
