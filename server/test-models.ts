import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function test(modelName: string) {
  try {
    console.log(`Testing model: ${modelName}`);
    const result = await ai.models.generateContent({
      model: modelName,
      contents: "Hello, this is a test. Reply with 'ACK'."
    });
    console.log(`Response from ${modelName}:`, result.text);
  } catch (e: any) {
    console.error(`Error for ${modelName}:`, e.message);
  }
}

async function run() {
  await test("gemini-1.5-flash");
  await test("gemini-2.0-flash");
  await test("gemini-3.8-flash");
}
run();
