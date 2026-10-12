import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

async function test() {
  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: "Hello, this is a test. Reply with 'ACK'."
    });
    console.log("Response:", result.text);
  } catch (e) {
    console.error("Error generating content:", e);
    process.exit(1);
  }
}

test();
