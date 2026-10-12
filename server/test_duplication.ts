import { aiProvider } from './src/services/ai';

const tests = [
  "yoo boy",
  "kya karraheho",
  "bro aaj mood off hai"
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
    
    let streamAggregated = "";
    const res = await aiProvider.generateStreamingResponse(
      t, 
      [], 
      emotion as any, 
      [], 
      undefined, 
      'best_friend',
      (chunk) => {
        streamAggregated += chunk;
      }
    );
    console.log(`Stream Aggregated Result: ${streamAggregated}`);
    console.log(`Final Return Result: ${res}`);
    if (streamAggregated === res) {
      console.log("-> MATCH: Stream chunks aggregate perfectly to final response. No backend duplication.");
    } else {
      console.error("-> MISMATCH: Backend duplication detected!");
    }
  }
}

runTests().catch(console.error);
