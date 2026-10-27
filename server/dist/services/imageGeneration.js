"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageService = exports.ImageGenerationService = void 0;
const genai_1 = require("@google/genai");
const replicate_1 = __importDefault(require("replicate"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ImageGenerationService {
    ai = null;
    replicate = null;
    replicateToken = null;
    primaryGenModel;
    fallbackGenModel;
    primaryEditModel;
    fallbackEditModel;
    timeoutMs;
    capabilityStatus = 'not_configured';
    capabilityDetail = 'Replicate API token is not configured.';
    constructor(config) {
        const geminiKey = config?.geminiApiKey || process.env.GEMINI_API_KEY;
        if (geminiKey) {
            this.ai = new genai_1.GoogleGenAI({ apiKey: geminiKey });
        }
        this.replicateToken = config?.replicateApiToken || process.env.REPLICATE_API_TOKEN || null;
        if (this.replicateToken) {
            this.replicate = new replicate_1.default({ auth: this.replicateToken });
            this.capabilityStatus = 'operational';
            this.capabilityDetail = 'Replicate image generation is operational.';
        }
        else {
            this.replicate = null;
            this.capabilityStatus = 'not_configured';
            this.capabilityDetail = 'REPLICATE_API_TOKEN is not configured in server/.env.';
        }
        this.primaryGenModel = config?.primaryGenModel || 'black-forest-labs/flux-schnell';
        this.fallbackGenModel = config?.fallbackGenModel || 'stabilityai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd44c927f79ac';
        this.primaryEditModel = config?.primaryEditModel || 'timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ea23f';
        this.fallbackEditModel = config?.fallbackEditModel || 'stabilityai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd44c927f79ac';
        this.timeoutMs = config?.timeoutMs || 90000;
    }
    getCapabilityStatus() {
        if (!this.replicateToken) {
            return { status: 'not_configured', detail: 'REPLICATE_API_TOKEN is not configured in server/.env.' };
        }
        return { status: this.capabilityStatus, detail: this.capabilityDetail };
    }
    setCapabilityStatus(status, detail) {
        this.capabilityStatus = status;
        if (detail)
            this.capabilityDetail = detail;
    }
    /**
     * Classify user intent and refine prompt for image generation/editing.
     */
    async classifyIntent(message, hasUploadedImage, hasRecentImageInHistory) {
        if (!this.ai) {
            return { intent: 'chat', refinedPrompt: '', confidence: 0 };
        }
        try {
            const prompt = `You are the Intent Classifier for an AI assistant.
Determine whether the user's latest message is:
1. "image_capability": Asking whether you can create, make, draw, generate, or edit images, asking about image features/capabilities, or asking how image generation works (e.g. "Kya tum image create kar sakte ho?", "Can you create images?", "Kya tum image bana sakte ho?", "Do you generate photos?", "Can you edit pictures?"). NOTE: The user is NOT asking to generate an image right now; they are simply asking about your ability.
2. "image_generate": Requesting to create a brand new image from a text description right now (e.g. "generate a picture of...", "create an image of...", "draw a...", "make wallpaper with...", "bhai photo bana", "Ek poster bana de").
3. "image_edit": Requesting to modify, edit, or transform an existing or uploaded image (e.g. "remove background", "change shirt color", "make it cinematic", "turn this into anime", "Generate an anime version of this photo").
4. "chat": General text conversation, emotional sharing, questions, or asking questions about an uploaded image (e.g. "what is this?", "who is in this picture?", "can you explain this chart?").

Rules:
- Questions about ability/possibility ("Can you create...", "Kya tum bana sakte ho...", "Do you make images?", "Can you edit pictures?") MUST ALWAYS be classified as "image_capability".
- Direct requests/imperatives to generate an image ("Ek poster bana de", "Make a photo of a cat", "Draw a sunset") MUST be classified as "image_generate".
- Requests to edit an image MUST be classified as "image_edit".
- If the user provided an image and is asking questions to understand it ("what is this?", "describe this"), classify as "chat".
- For "image_generate" and "image_edit", generate a high-detail, vivid English "refinedPrompt" that captures all user instructions, visual details, style, composition, and lighting suitable for an image model.
- For "image_capability" or "chat", refinedPrompt can be empty.

Current user message: "${message}"
Has attached image right now: ${hasUploadedImage}
Has recent image in conversation history: ${hasRecentImageInHistory}

Respond strictly in valid JSON:
{
  "intent": "image_capability" | "image_generate" | "image_edit" | "chat",
  "refinedPrompt": string,
  "confidence": number
}`;
            const res = await this.ai.models.generateContent({
                model: 'gemini-3.5-flash-lite',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    temperature: 0.2
                }
            });
            const text = res.text?.trim() || '{}';
            const parsed = JSON.parse(text);
            if (parsed.intent && ['image_capability', 'image_generate', 'image_edit', 'chat'].includes(parsed.intent)) {
                return {
                    intent: parsed.intent,
                    refinedPrompt: parsed.refinedPrompt || '',
                    confidence: parsed.confidence || 0.95
                };
            }
        }
        catch (e) {
            console.error('[ImageService] Intent classification error:', e);
        }
        // Heuristic fallback
        const lower = message.toLowerCase().trim();
        const capabilityPatterns = [
            /can you (create|make|generate|draw|edit) (images?|photos?|pictures?)/i,
            /kya tum (image|photo|picture|tasveer) (bana|create|generate)/i,
            /do you (create|make|generate|support) (images?|photos?)/i,
            /are you able to (create|make|generate|draw) (images?|photos?)/i,
            /kya aap (image|photo) bana sakte/i,
            /can you do image generation/i,
            /image (bana|create|generate) kar sakte ho/i
        ];
        if (capabilityPatterns.some(regex => regex.test(lower))) {
            return { intent: 'image_capability', refinedPrompt: '', confidence: 0.95 };
        }
        const generateKeywords = ['generate', 'create image', 'draw', 'picture of', 'make an image', 'wallpaper', 'illustration of', 'poster bana', 'photo bana'];
        const editKeywords = ['remove background', 'change background', 'turn into anime', 'recolor', 'make it cinematic', 'edit this image', 'change the color'];
        if (hasUploadedImage && editKeywords.some(k => lower.includes(k))) {
            return { intent: 'image_edit', refinedPrompt: message, confidence: 0.8 };
        }
        if (!hasUploadedImage && generateKeywords.some(k => lower.includes(k))) {
            return { intent: 'image_generate', refinedPrompt: message, confidence: 0.8 };
        }
        return { intent: 'chat', refinedPrompt: '', confidence: 0.7 };
    }
    /**
     * Generate an image from a text prompt using Replicate (FLUX / SDXL).
     */
    async generateImage(prompt) {
        if (!this.replicate || !this.replicateToken) {
            return {
                success: false,
                error: 'Image generation is currently not configured. Please set REPLICATE_API_TOKEN in server/.env.',
                code: 'PROVIDER_ERROR',
                canRetry: false
            };
        }
        const candidateModels = [this.primaryGenModel, this.fallbackGenModel];
        let lastError = null;
        for (const model of candidateModels) {
            try {
                console.log(`[Replicate] Running image generation with model: ${model}`);
                const runPromise = this.replicate.run(model, {
                    input: {
                        prompt
                    }
                });
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Image generation request timed out')), this.timeoutMs));
                const output = await Promise.race([runPromise, timeoutPromise]);
                const outputUrl = this.extractOutputUrl(output);
                if (!outputUrl) {
                    throw new Error('Replicate did not return a valid image URL');
                }
                console.log(`[Replicate] Generated image successfully! Output URL: ${outputUrl.substring(0, 60)}...`);
                // Fetch image bytes
                const res = await fetch(outputUrl);
                if (!res.ok) {
                    throw new Error(`Failed to download image from Replicate: HTTP ${res.status}`);
                }
                const arrayBuffer = await res.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');
                const mimeType = res.headers.get('content-type') || 'image/webp';
                this.setCapabilityStatus('operational', 'Replicate image generation is operational.');
                return {
                    success: true,
                    data: base64Data,
                    mimeType,
                    url: outputUrl,
                    textDescription: `Generated image based on: "${prompt}"`
                };
            }
            catch (err) {
                lastError = err;
                console.error(`[Replicate] Error with model ${model}:`, err.message || err);
                const errorInfo = this.normalizeError(err);
                if (errorInfo.code === 'QUOTA_EXCEEDED') {
                    this.setCapabilityStatus('unavailable_quota', errorInfo.message);
                    return {
                        success: false,
                        error: errorInfo.message,
                        code: errorInfo.code,
                        canRetry: false
                    };
                }
                if (errorInfo.code === 'PROVIDER_ERROR' && !errorInfo.canRetry) {
                    return {
                        success: false,
                        error: errorInfo.message,
                        code: errorInfo.code,
                        canRetry: false
                    };
                }
            }
        }
        const normalized = this.normalizeError(lastError);
        return {
            success: false,
            error: normalized.message,
            code: normalized.code,
            canRetry: normalized.canRetry
        };
    }
    /**
     * Edit an existing or uploaded image using instructions via Replicate.
     */
    async editImage(instruction, originalImage) {
        if (!this.replicate || !this.replicateToken) {
            return {
                success: false,
                error: 'Image editing is currently not configured. Please set REPLICATE_API_TOKEN in server/.env.',
                code: 'PROVIDER_ERROR',
                canRetry: false
            };
        }
        if (!originalImage.data || !originalImage.mimeType) {
            return {
                success: false,
                error: 'Original image data or MIME type is missing for editing.',
                code: 'INVALID_INPUT',
                canRetry: false
            };
        }
        const imageDataUri = `data:${originalImage.mimeType};base64,${originalImage.data}`;
        const candidateModels = [this.primaryEditModel, this.fallbackEditModel];
        let lastError = null;
        for (const model of candidateModels) {
            try {
                console.log(`[Replicate] Running image edit with model: ${model}`);
                const runPromise = this.replicate.run(model, {
                    input: {
                        prompt: instruction,
                        image: imageDataUri
                    }
                });
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Image editing request timed out')), this.timeoutMs));
                const output = await Promise.race([runPromise, timeoutPromise]);
                const outputUrl = this.extractOutputUrl(output);
                if (!outputUrl) {
                    throw new Error('Replicate did not return a valid edited image URL');
                }
                console.log(`[Replicate] Edited image successfully! Output URL: ${outputUrl.substring(0, 60)}...`);
                const res = await fetch(outputUrl);
                if (!res.ok) {
                    throw new Error(`Failed to download edited image from Replicate: HTTP ${res.status}`);
                }
                const arrayBuffer = await res.arrayBuffer();
                const base64Data = Buffer.from(arrayBuffer).toString('base64');
                const mimeType = res.headers.get('content-type') || 'image/png';
                this.setCapabilityStatus('operational', 'Replicate image generation is operational.');
                return {
                    success: true,
                    data: base64Data,
                    mimeType,
                    url: outputUrl,
                    textDescription: `Edited image: "${instruction}"`
                };
            }
            catch (err) {
                lastError = err;
                console.error(`[Replicate] Edit error with model ${model}:`, err.message || err);
                const errorInfo = this.normalizeError(err);
                if (errorInfo.code === 'QUOTA_EXCEEDED') {
                    this.setCapabilityStatus('unavailable_quota', errorInfo.message);
                    return {
                        success: false,
                        error: errorInfo.message,
                        code: errorInfo.code,
                        canRetry: false
                    };
                }
                if (errorInfo.code === 'PROVIDER_ERROR' && !errorInfo.canRetry) {
                    return {
                        success: false,
                        error: errorInfo.message,
                        code: errorInfo.code,
                        canRetry: false
                    };
                }
            }
        }
        const normalized = this.normalizeError(lastError);
        return {
            success: false,
            error: normalized.message,
            code: normalized.code,
            canRetry: normalized.canRetry
        };
    }
    /**
     * Safely extract output image URL from Replicate output.
     */
    extractOutputUrl(output) {
        if (!output)
            return null;
        const item = Array.isArray(output) ? output[0] : output;
        if (!item)
            return null;
        if (typeof item === 'string' && item.startsWith('http'))
            return item;
        if (typeof item.url === 'function') {
            const u = item.url();
            if (typeof u === 'string')
                return u;
            if (u && typeof u.href === 'string')
                return u.href;
        }
        if (typeof item.url === 'string' && item.url.startsWith('http'))
            return item.url;
        if (typeof item.toString === 'function') {
            const str = item.toString();
            if (str && str.startsWith('http'))
                return str;
        }
        return null;
    }
    /**
     * Normalize provider error codes and messages into user-friendly explanations.
     * Strips internal provider stack traces and never exposes API keys.
     */
    normalizeError(error) {
        const rawMsg = error?.message || String(error || '');
        const status = error?.status || error?.statusCode;
        // Unauthorized or missing token
        if (status === 401 || rawMsg.includes('401') || rawMsg.includes('Unauthenticated') || rawMsg.includes('Invalid token')) {
            return {
                code: 'PROVIDER_ERROR',
                message: 'Image generation is currently not configured. Please set REPLICATE_API_TOKEN in server configuration.',
                canRetry: false
            };
        }
        // Insufficient credits or payment required
        if (status === 402 ||
            rawMsg.includes('402') ||
            rawMsg.toLowerCase().includes('payment required') ||
            rawMsg.toLowerCase().includes('insufficient credits') ||
            rawMsg.toLowerCase().includes('credit') ||
            rawMsg.toLowerCase().includes('billing') ||
            rawMsg.toLowerCase().includes('quota') ||
            rawMsg.includes('RESOURCE_EXHAUSTED')) {
            return {
                code: 'QUOTA_EXCEEDED',
                message: 'Image generation is temporarily unavailable due to insufficient credits or quota on Replicate.',
                canRetry: false
            };
        }
        // Rate limiting
        if (status === 429 || rawMsg.includes('429') || rawMsg.toLowerCase().includes('rate limit')) {
            return {
                code: 'RATE_LIMIT',
                message: 'The image generation service is currently experiencing high demand. Please wait a moment and try again.',
                canRetry: true
            };
        }
        // Safety filter
        if (rawMsg.toLowerCase().includes('safety') || rawMsg.toLowerCase().includes('nsfw') || rawMsg.toLowerCase().includes('flagged')) {
            return {
                code: 'SAFETY_BLOCKED',
                message: 'The requested prompt was flagged by content safety guidelines. Please modify your prompt and try again.',
                canRetry: true
            };
        }
        // Timeout
        if (rawMsg.toLowerCase().includes('timeout') || rawMsg.toLowerCase().includes('timed out')) {
            return {
                code: 'TIMEOUT',
                message: 'Image generation took longer than expected. Please try again.',
                canRetry: true
            };
        }
        // High demand / service unavailable
        if (status === 503 || rawMsg.includes('503') || rawMsg.toLowerCase().includes('high demand') || rawMsg.toLowerCase().includes('unavailable')) {
            return {
                code: 'MODEL_UNAVAILABLE',
                message: 'The image generation service is temporarily under high demand. Please try again in a few moments.',
                canRetry: true
            };
        }
        // Generic friendly error (never expose internal stack traces or secrets)
        return {
            code: 'PROVIDER_ERROR',
            message: 'Image generation is temporarily unavailable. Please try again later.',
            canRetry: false
        };
    }
}
exports.ImageGenerationService = ImageGenerationService;
exports.imageService = new ImageGenerationService();
