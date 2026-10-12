import { aiProvider } from './src/services/ai';

async function test() {
  try {
    const emotion = {
      primaryEmotion: 'happy',
      secondaryEmotion: null,
      intensity: 0.5,
      userNeed: 'listen',
      adviceRequested: false,
      language: 'English',
      communicationStyle: 'casual',
      safetyRisk: 'none'
    };

    console.log("Calling generateStreamingResponse...");
    const res = await aiProvider.generateStreamingResponse(
      "Hello, world!",
      [],
      emotion as any,
      [],
      undefined,
      (chunk) => process.stdout.write(chunk)
    );
    console.log("\nResponse:", res);
  } catch (e: any) {
    console.error("CAUGHT ERROR:", e);
    console.error("Status:", e.status);
    console.error("Message:", e.message);
  }
}

test();
