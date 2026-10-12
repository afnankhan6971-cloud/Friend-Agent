import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url!, key!);

async function testRLS() {
  const userAEmail = `userA-${Date.now()}@example.com`;
  const userBEmail = `userB-${Date.now()}@example.com`;
  const password = 'Testpassword123!';

  // Because Supabase requires email confirmations by default, creating users via REST might fail.
  // Wait, we got "invalid email" before because of the format or something?
  // Let's try creating a user again, carefully logging the error.
  
  let { data: authA, error: errA } = await supabase.auth.signUp({ email: userAEmail, password });
  if (errA) {
    console.error("User A signup failed. Is email confirmation required, or are fake emails blocked?", errA.message);
    process.exit(1);
  }
  
  let { data: authB, error: errB } = await supabase.auth.signUp({ email: userBEmail, password });
  if (errB) {
    console.error("User B signup failed:", errB.message);
    process.exit(1);
  }
  
  const tokenA = authA.session?.access_token;
  const tokenB = authB.session?.access_token;

  if (!tokenA || !tokenB) {
    console.error("No access tokens returned! Email confirmation is likely enabled. We cannot test RLS via this script unless email confirmations are disabled.");
    process.exit(1);
  }

  // Use a dedicated client for User A and B
  const clientA = createClient(url!, key!, { global: { headers: { Authorization: `Bearer ${tokenA}` } } });
  const clientB = createClient(url!, key!, { global: { headers: { Authorization: `Bearer ${tokenB}` } } });

  // A creates conversation
  const { data: convA, error: convErrA } = await clientA.from('conversations').insert({
    user_id: authA.user!.id,
    title: 'User A Conversation'
  }).select().single();

  console.log("User A created conv:", convA?.id);

  // B tries to read A's conversation
  const { data: readAByB } = await clientB.from('conversations').select('*').eq('id', convA!.id);
  console.log("User B reading User A's conv:", readAByB);

  // B tries to add a message to A's conversation
  const { error: msgErrB } = await clientB.from('messages').insert({
    conversation_id: convA!.id,
    role: 'user',
    content: 'Hacked by B',
    message_type: 'text'
  });
  console.log("User B inserting into User A's conv error:", msgErrB?.message);
}

testRLS();
