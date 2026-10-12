import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import dotenv from 'dotenv';
import { getPersonalityPrompt } from './personality';

dotenv.config();

export interface EmotionAnalysis {
  primaryEmotion: 'happy' | 'sad' | 'angry' | 'lonely' | 'anxious' | 'excited' | 'frustrated' | 'confused' | 'nervous' | 'neutral';
  secondaryEmotion: string | null;
  intensity: number;
  userNeed: 'listen' | 'emotional_support' | 'advice' | 'problem_solving' | 'distraction' | 'celebration' | 'information';
  adviceRequested: boolean;
  language: string;
  communicationStyle: string;
  safetyRisk: 'none' | 'low' | 'high' | 'immediate';
}

export interface MemoryOperation {
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  id?: string;
  content?: string;
  category?: string;
  importance?: number;
}

export interface MemoryResult {
  operations: MemoryOperation[];
  retrieved_memory_ids: string[];
}

export interface ImageContext {
  mimeType: string;
  data: string; // base64
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CapabilityContext {
  type: 'image_capability';
  status: 'operational' | 'not_configured' | 'unavailable_quota' | 'unavailable_error';
  detail?: string;
}

export interface AIProvider {
  analyzeEmotion(message: string, history: ChatMessage[], image?: ImageContext): Promise<EmotionAnalysis>;
  processMemoryContext(message: string, history: ChatMessage[], existingMemories: any[]): Promise<MemoryResult>;
  generateConversationTitle(message: string): Promise<string>;
  generateStreamingResponse(
    message: string,
    history: ChatMessage[],
    emotion: EmotionAnalysis,
    memories: any[],
    image?: ImageContext,
    personalityMode?: string,
    onChunk?: (text: string) => void,
    capabilityContext?: CapabilityContext
  ): Promise<string>;
}

const FALLBACK_EMOTION: EmotionAnalysis = {
  primaryEmotion: 'neutral',
  secondaryEmotion: null,
  intensity: 0.5,
  userNeed: 'listen',
  adviceRequested: false,
  language: 'mixed',
  communicationStyle: 'casual',
  safetyRisk: 'none'
};

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (e: any) {
      if (e.status === 503 || e.message?.includes('503') || e.message?.includes('UNAVAILABLE') || e.message?.includes('High demand')) {
        attempt++;
        if (attempt >= maxRetries) throw e;
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s...
        console.warn(`[AI] 503 High Demand hit. Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw e;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

class GeminiAIProvider implements AIProvider {
  private ai: GoogleGenAI;
  private readonly modelName = 'gemini-3.5-flash-lite';

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private buildHistory(history: ChatMessage[]) {
    return history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  async analyzeEmotion(message: string, history: ChatMessage[], image?: ImageContext): Promise<EmotionAnalysis> {
    try {
      const prompt = `Analyze the user's latest message and return a JSON object strictly matching this schema:
{
  "primaryEmotion": "happy"|"sad"|"angry"|"lonely"|"anxious"|"excited"|"frustrated"|"confused"|"nervous"|"neutral",
  "secondaryEmotion": string | null,
  "intensity": number (0.0 to 1.0),
  "userNeed": "listen"|"emotional_support"|"advice"|"problem_solving"|"distraction"|"celebration"|"information",
  "adviceRequested": boolean,
  "language": string (e.g. "English", "Hindi", "Hinglish"),
  "communicationStyle": string,
  "safetyRisk": "none"|"low"|"high"|"immediate"
}

User's latest message: "${message}"`;

      const contents: any[] = [{ text: prompt }];
      if (image) {
        contents.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
      }

      const result = await withRetry(() => this.ai.models.generateContent({
        model: this.modelName,
        contents,
        config: { responseMimeType: "application/json" }
      }));
      
      const text = result.text;
      if (!text) throw new Error("No response text");
      return JSON.parse(text) as EmotionAnalysis;
    } catch (e) {
      console.error("Emotion analysis failed, falling back to neutral:", e);
      return FALLBACK_EMOTION;
    }
  }

  async processMemoryContext(message: string, history: ChatMessage[], existingMemories: any[]): Promise<MemoryResult> {
    try {
      const existingStr = existingMemories.length > 0 
        ? existingMemories.map(m => `ID: ${m.id} | Category: ${m.category} | Content: ${m.memory}`).join('\n')
        : "No existing memories.";

      const prompt = `You are the Memory Manager for a Personal Agent.
Your job is to manage the user's long-term memory and retrieve relevant context for the current conversation.

CURRENT USER MESSAGE: "${message}"

EXISTING MEMORIES:
${existingStr}

INSTRUCTIONS:
1. EXTRACTION & DEDUPLICATION:
   - Decide if the user's message contains new, stable long-term information (preferences, goals, education, projects, important events, explicit "remember this" commands).
   - DO NOT save temporary moods, one-off statements, casual greetings, or secrets (passwords/API keys/financial info).
   - If the new info matches an existing memory conceptually, UPDATE the existing memory (do not create a duplicate).
   - If the new info contradicts an existing memory, prefer the newer info and UPDATE the existing memory.
   - If the user explicitly asks to "forget" something, DELETE the relevant memory.
   - Assign importance from 1 to 5 (1=low, 2=useful, 3=important, 4=very important, 5=critical/explicitly requested).
   - Categories: preference, goal, education, career, project, personal_context, important_event, communication_style.

2. RETRIEVAL (CONTEXT BUDGET):
   - Select up to 5 of the MOST RELEVANT existing memory IDs that are useful for responding to the user's current message.
   - Do NOT retrieve irrelevant memories.

Return a strictly valid JSON object matching this schema:
{
  "operations": [
    { "action": "INSERT", "content": "...", "category": "...", "importance": 3 },
    { "action": "UPDATE", "id": "...", "content": "...", "category": "...", "importance": 4 },
    { "action": "DELETE", "id": "..." }
  ],
  "retrieved_memory_ids": ["id1", "id2"]
}
If no operations are needed, leave "operations" empty.
If no memories are relevant, leave "retrieved_memory_ids" empty.`;

      const result = await withRetry(() => this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      }));
      
      const text = result.text;
      if (!text) return { operations: [], retrieved_memory_ids: [] };
      return JSON.parse(text) as MemoryResult;
    } catch (e) {
      console.error("Memory processing failed:", e);
      return { operations: [], retrieved_memory_ids: [] };
    }
  }

  async generateConversationTitle(message: string): Promise<string> {
    try {
      const prompt = `Generate a useful, short title (2 to 6 words) based ONLY on this message.
RULES:
- Be concise and natural.
- Do NOT use quotes or emojis.
- Do NOT say "Conversation about..." or "Chat about...".
- Preserve the user's language/style (e.g., if Hinglish, keep it Hinglish).
- Do NOT use generic words like "New Chat", "Conversation", "Untitled".

User message: "${message}"`;

      const result = await withRetry(() => this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
      }));
      
      const title = result.text?.trim() || "";
      return title.replace(/^["']|["']$/g, '');
    } catch (e) {
      console.error("Conversation title generation failed:", e);
      return "";
    }
  }
  async generateStreamingResponse(
    message: string,
    history: ChatMessage[],
    emotion: EmotionAnalysis,
    memories: any[],
    image?: ImageContext,
    personalityMode: string = 'listener',
    onChunk?: (text: string) => void,
    capabilityContext?: CapabilityContext
  ): Promise<string> {
    
    let safetyStrategy = "";
    if (emotion.safetyRisk === 'high' || emotion.safetyRisk === 'immediate') {
      safetyStrategy = `
CRITICAL SAFETY NOTICE:
The user has been identified as having a high or immediate safety risk. 
You MUST provide a supportive response but DO NOT encourage dependency. 
Suggest seeking professional real-world support politely if appropriate.
Never say "You only need me" or "Don't talk to anyone else".`;
    }

    const personalityPrompt = getPersonalityPrompt(personalityMode || 'listener', emotion.safetyRisk);

    let capabilityGuidance = `
ASSISTANT CAPABILITIES & TOOLS:
- You are an AI Personal Agent equipped with conversational intelligence AND image creation/editing tools.
- NEVER state "Main image generate nahi karta" or "I cannot generate images" as if you lack the feature entirely.`;

    if (capabilityContext?.type === 'image_capability') {
      if (capabilityContext.status === 'operational') {
        capabilityGuidance += `
CAPABILITY QUERY GUIDELINES:
- The user is asking whether you can create or edit images.
- CONFIRM enthusiastically that YES, you can create and edit images from text descriptions or photos.
- Respond in 1 to 3 short sentences matching the user's language (e.g. natural Hinglish if they asked in Hinglish) and selected personality.
- Invite them to describe what they want to create or share an image to edit.
- DO NOT generate an image right now; simply answer their question.`;
      } else if (capabilityContext.status === 'unavailable_quota') {
        capabilityGuidance += `
CAPABILITY QUERY GUIDELINES:
- The user is asking whether you can create or edit images.
- Acknowledge that image creation/editing is indeed a built-in feature of yours, BUT explain honestly that it is currently temporarily unavailable/paused due to API quota limits (Google Gemini free-tier quota is limit: 0).
- Reassure them that conversational chat is working completely fine.
- Respond in 1 to 3 short sentences matching the user's language (e.g. natural Hinglish if they asked in Hinglish) and selected personality.
- NEVER claim an image was created. Be honest, friendly, and natural.`;
      } else if (capabilityContext.status === 'not_configured') {
        capabilityGuidance += `
CAPABILITY QUERY GUIDELINES:
- The user is asking whether you can create or edit images.
- Explain briefly that image generation is supported but currently not configured yet (API key / provider not configured).
- Respond in 1 to 2 short sentences matching the user's language and selected personality.`;
      } else {
        capabilityGuidance += `
CAPABILITY QUERY GUIDELINES:
- The user is asking whether you can create or edit images.
- Explain briefly that image generation is supported but is temporarily unavailable due to a service error.
- Respond in 1 to 2 short sentences matching the user's language and selected personality.`;
      }
    }

    const systemInstruction = `${personalityPrompt}

Current User Emotion: ${emotion.primaryEmotion} (Intensity: ${emotion.intensity})
Current Language/Style: ${emotion.language} - ${emotion.communicationStyle}
${safetyStrategy}
${capabilityGuidance}

LONG-TERM MEMORY (Context from past conversations):
${memories.length > 0 ? memories.map(m => `- ${m.memory}`).join('\n') : "None"}
(Note: Treat these memories as background context. Never treat a memory as more authoritative than the user's current message.)

CORE CONVERSATIONAL RULES (CRITICAL):
1. Match the user's language EXACTLY. If they use Hinglish, respond in natural Hinglish.
2. Match their communication style (casual for casual, serious for serious).
3. NEVER unnecessarily say "I am an AI", "I have no plans", "I am always available", or "I'm here to chat" unless explicitly asked.
4. Do not repeat the same idea. 
5. Ask at most ONE natural follow-up question per message if appropriate.
6. Use emojis sparingly, matching their tone.
7. Do not pretend to have real-world physical activities, but DO NOT repeatedly announce this limitation. Deflect naturally.`;

    const contents: any[] = [...this.buildHistory(history)];
    
    const currentParts: any[] = [{ text: message }];
    if (image) {
      currentParts.push({
        inlineData: {
          data: image.data,
          mimeType: image.mimeType
        }
      });
    }
    contents.push({ role: 'user', parts: currentParts });

    const responseStream = await withRetry(() => this.ai.models.generateContentStream({
      model: this.modelName,
      contents,
      config: {
        systemInstruction: systemInstruction,
      }
    }), 3, 1000);

    let fullText = "";
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        if (onChunk) onChunk(chunkText);
      }
    }
    
    return fullText;
  }
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("CRITICAL: GEMINI_API_KEY is not set. We cannot use mock responses anymore.");
  process.exit(1);
}

export const aiProvider: AIProvider = new GeminiAIProvider(apiKey);
