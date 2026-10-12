import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testModel(modelName: string) {
  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: "Hi",
    });
    console.log(`[SUCCESS] ${modelName} is available and working. Response: ${result.text?.slice(0, 20)}...`);
  } catch (e: any) {
    if (e.status === 429) {
      console.log(`[QUOTA EXCEEDED] ${modelName} returned 429.`);
    } else {
      console.log(`[ERROR] ${modelName} returned an error: ${e.message}`);
    }
  }
}

async function main() {
  const modelsToTest = [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-lite-latest'
  ];
  
  for (const model of modelsToTest) {
    await testModel(model);
    // wait a bit between requests
    await new Promise(r => setTimeout(r, 1000));
  }
}

main();
