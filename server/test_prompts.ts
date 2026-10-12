import { aiProvider } from './src/services/ai';

const tests = [
  "kya karraheho",
  "bro aaj mood off hai",
  "kal exam hai kuch padha nahi",
  "bhai ek joke suna",
  "mujhe ye concept samjha"
];

async function runTests() {
  for (const t of tests) {
    console.log(`\n--- Test: "${t}" ---`);
    const emotion = {
      primaryEmotion: 'neutral',
      secondaryEmotion: null,
      intensity: 0.5,
      userNeed: 'listen',
      adviceRequested: false,
      language: 'Hinglish',
      communicationStyle: 'casual',
      safetyRisk: 'none'
    };
    
    // Test with 'best_friend' personality
    const res = await aiProvider.generateStreamingResponse(
      t, 
      [], 
      emotion as any, 
      [], 
      undefined, 
      'best_friend'
    );
    console.log(`Response: ${res}`);
  }
}

runTests().catch(console.error);
