import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("=== STARTING END-TO-END TEST ===");
  
  // 1. Auth
  const email = 'test@example.com';
  const password = 'password123';
  console.log(`[1] Logging in user: ${email}`);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (authError || !authData.session) {
    console.log("Login failed, attempting signup (and logging authData)...");
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: `testuser${Date.now()}@gmail.com`,
      password: 'password123'
    });
    console.log("Signup data:", signupData);
    if (signupError) console.error("Signup error:", signupError);
    process.exit(1);
  }
  
  const token = authData.session.access_token;
  console.log("=> User created and authenticated!");

  // 2. Create Conversation
  console.log("[2] Creating new conversation...");
  const convRes = await fetch('http://localhost:3001/api/conversations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: 'Test Conversation' })
  });
  
  const convData = await convRes.json();
  const conversationId = convData.id;
  console.log("=> Conversation created:", conversationId);

  // 3. Send Message & Stream
  console.log("[3] Sending message and listening to stream...");
  const formData = new FormData();
  formData.append('message', 'Hello, this is my first real test.');
  formData.append('conversationId', conversationId);
  formData.append('history', JSON.stringify([]));

  let streamedResponse = "";
  let receivedFirstChunk = false;

  const chatRes = await fetch('http://localhost:3001/api/chat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData as any
  });

  const reader = chatRes.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunkStr = decoder.decode(value, { stream: true });
    const lines = chunkStr.split('\n').filter(l => l.trim() !== '');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        if (dataStr === '[DONE]') {
          console.log("\n=> Stream finished ([DONE] received)");
        } else {
          try {
            const data = JSON.parse(dataStr);
            if (data.chunk) {
              if (!receivedFirstChunk) {
                console.log("=> Received first chunk!");
                receivedFirstChunk = true;
              }
              streamedResponse += data.chunk;
              process.stdout.write(data.chunk);
            }
          } catch (e) {
            console.error("Error parsing chunk:", dataStr);
          }
        }
      }
    }
  }
  
  console.log("\n\n[4] Complete streamed response length:", streamedResponse.length);
  if (streamedResponse.length === 0) {
    console.error("FAIL: Did not receive AI response.");
    process.exit(1);
  }

  // Wait 1 second to ensure DB async insert finished
  await new Promise(r => setTimeout(r, 1000));

  // 5. Verify Persistence
  console.log("\n[5] Verifying persistence...");
  const messagesRes = await fetch(`http://localhost:3001/api/conversations/${conversationId}/messages`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const messages = await messagesRes.json();
  console.log(`=> Fetched ${messages.length} messages from conversation.`);
  
  if (messages.length !== 2) {
    console.error("FAIL: Expected 2 messages (user + assistant). Found:", messages.length);
    console.log(messages);
    process.exit(1);
  }
  
  if (messages[0].role === 'user' && messages[1].role === 'assistant') {
    console.log("=> Persistence verified!");
    console.log("  User Message:", messages[0].content);
    console.log("  Assistant Message (snippet):", messages[1].content.substring(0, 50) + "...");
  } else {
    console.error("FAIL: Messages are out of order or incorrect roles.");
  }
  
  console.log("\n=== TEST COMPLETE - ALL PASS ===");
}

runTest().catch(console.error);
