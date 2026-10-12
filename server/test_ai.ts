import { aiProvider } from './src/services/ai';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    console.log("Testing Emotion Analysis...");
    const emotion = await aiProvider.analyzeEmotion("Hello, this is my first real test.", []);
    console.log("Emotion:", emotion);
    
    console.log("\nTesting Generation Stream...");
    const stream = await aiProvider.generateStreamingResponse(
      "Hello, this is my first real test.",
      [],
      emotion,
      []
    );
    console.log("Response:", stream);
    
    console.log("\nALL PASS");
  } catch (e) {
    console.error("AI FAIL:", e);
    process.exit(1);
  }
}
run();
