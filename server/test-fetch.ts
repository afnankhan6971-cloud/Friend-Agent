import fs from 'fs';

async function test() {
  const formData = new FormData();
  formData.append('message', 'Hey bhai, aaj mera mood thoda off hai.');
  
  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let complete = false;
    while (!complete) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      process.stdout.write(chunk);
    }
    console.log("\nDone streaming");
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
