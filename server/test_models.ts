import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function testIntentClassifier() {
  const tests = [
    { text: "Generate a futuristic city at night.", hasImage: false },
    { text: "Bhai ek anime-style astronaut bana.", hasImage: false },
    { text: "Create a premium product image for my headphones.", hasImage: false },
    { text: "Generate a minimal wallpaper with dark teal colors.", hasImage: false },
    { text: "Remove the background.", hasImage: true },
    { text: "What breed of dog is this?", hasImage: true },
    { text: "I feel really stressed today, can we talk?", hasImage: false },
  ];

  for (const t of tests) {
    const prompt = `You are the Intent Classifier for an AI assistant.
Determine whether the user wants to:
1. "image_generate": Create a brand new image from a text description.
2. "image_edit": Edit/modify an existing or uploaded image (e.g., change background, recolor, stylize, remove elements).
3. "chat": General conversation, advice, emotional support, or asking questions about an image (visual understanding).

Rules:
- If the user provided an image and is asking a question about it ("what is this?", "who is this?"), classify as "chat".
- If the user provided an image and asks to alter/edit/modify it ("remove background", "make it cinematic", "turn into anime"), classify as "image_edit".
- If user requests image generation without an uploaded image, classify as "image_generate".
- For image_generate and image_edit, provide a high quality English "refinedPrompt" optimized for image generation/editing.

User message: "${t.text}"
Has attached image: ${t.hasImage}

Respond strictly in JSON:
{
  "intent": "image_generate" | "image_edit" | "chat",
  "refinedPrompt": string,
  "confidence": number
}`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    console.log(`Input: "${t.text}" (hasImage: ${t.hasImage})`);
    console.log(`Output:`, JSON.parse(res.text || '{}'));
    console.log('---');
  }
}

testIntentClassifier();
