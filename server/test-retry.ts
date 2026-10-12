import { aiProvider } from './src/services/ai';

async function testRetry() {
  console.log("Testing Gemini with Retries...");
  const startTime = Date.now();
  try {
    const res = await aiProvider.generateStreamingResponse(
      "Hello", 
      [], 
      { primaryEmotion: 'neutral', intensity: 0.5, userNeed: 'listen', adviceRequested: false, language: 'English', communicationStyle: 'casual', secondaryEmotion: null, safetyRisk: 'none' },
      [],
      undefined,
      (chunk) => process.stdout.write(chunk)
    );
    console.log("\nSuccess:", res);
  } catch (e: any) {
    console.error("\nFinal Error after retries:", e.message);
  }
  const endTime = Date.now();
  console.log(`Took ${endTime - startTime}ms`);
}

testRetry();
