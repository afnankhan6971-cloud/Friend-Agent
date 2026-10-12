import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({ model: 'gemini-3.5-flash-lite', contents: "Hi" })
  .then(r => console.log('SUCCESS: ', r.text))
  .catch(e => console.log('ERROR: ', e.message));
