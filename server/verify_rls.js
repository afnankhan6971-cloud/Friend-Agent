const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function runTest() {
  console.log("=== RLS VERIFICATION TEST ===");

  const randomEmail = `test_user_${Date.now()}@gmail.com`;
  const password = "Password123!";

  console.log(`Attempting to sign up user: ${randomEmail}`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: randomEmail,
    password: password
  });

  if (authError) {
    console.error("Signup failed:", authError.message);
    process.exit(1);
  }

  if (!authData.session) {
    console.error("Signup succeeded but no session was returned. Email confirmation might be required.");
    // Try to login just in case
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: randomEmail,
        password: password
    });
    if (loginError) {
        console.error("Login also failed:", loginError.message);
        process.exit(1);
    }
    authData.session = loginData.session;
    authData.user = loginData.user;
  }

  const jwt = authData.session.access_token;
  const userId = authData.user.id;
  console.log(`✅ Authenticated successfully! User ID: ${userId}`);

  // Create an authenticated client
  const authClient = createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${jwt}` }
    }
  });

  // 1. Authenticated user creates a conversation
  console.log("\n1. Testing Conversation Creation (Authenticated)...");
  const { data: convData, error: convError } = await authClient
    .from('conversations')
    .insert({ user_id: userId, title: 'RLS Verification Chat' })
    .select()
    .single();

  if (convError) {
    console.error("❌ Failed to create conversation:", convError.message);
  } else {
    console.log(`✅ Conversation created: ${convData.id}`);
    
    // 3. Verify the UUID
    if (convData.user_id === userId) {
      console.log(`✅ Row contains correct authenticated user UUID: ${convData.user_id}`);
    } else {
      console.error(`❌ Row has INCORRECT user UUID: ${convData.user_id}`);
    }
  }

  // 2. Authenticated user saves a message
  console.log("\n2. Testing Message Creation (Authenticated)...");
  let messageId = null;
  if (convData) {
    const { data: msgData, error: msgError } = await authClient
      .from('messages')
      .insert({
        conversation_id: convData.id,
        role: 'user',
        content: 'Testing RLS',
        message_type: 'text'
      })
      .select()
      .single();

    if (msgError) {
      console.error("❌ Failed to create message:", msgError.message);
    } else {
      console.log(`✅ Message created: ${msgData.id}`);
      messageId = msgData.id;
    }
  }

  // 4. Unauthenticated request is rejected
  console.log("\n4. Testing Unauthenticated Request...");
  const anonClient = createClient(url, key);
  
  const { data: anonData, error: anonError } = await anonClient
    .from('conversations')
    .select('*');

  if (anonError) {
    console.log(`✅ Unauthenticated request rejected: ${anonError.message}`);
  } else if (anonData && anonData.length === 0) {
    console.log(`✅ Unauthenticated request returned no data (RLS enforced).`);
  } else {
    console.error(`❌ Unauthenticated request was allowed to read data! Found ${anonData.length} rows.`);
  }

  const { data: anonInsertData, error: anonInsertError } = await anonClient
    .from('conversations')
    .insert({ user_id: userId, title: 'Hacked Chat' })
    .select();

  if (anonInsertError) {
    console.log(`✅ Unauthenticated INSERT rejected: ${anonInsertError.message}`);
  } else {
    console.error(`❌ Unauthenticated request was allowed to INSERT data!`);
  }
}

runTest();
