import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing Gemini API Key");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent("Hello, this is a test. Reply with 'ACK'.");
    console.log("Response:", result.response.text());
  } catch (e) {
    console.error("Error generating content:", e);
    process.exit(1);
  }
}

test();
