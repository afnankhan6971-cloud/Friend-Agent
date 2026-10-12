"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageService = exports.ImageGenerationService = void 0;
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class ImageGenerationService {
    ai = null;
    primaryModel;
    fallbackModels;
    timeoutMs;
    constructor(config) {
        const apiKey = config?.apiKey || process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.ai = new genai_1.GoogleGenAI({ apiKey });
        }
        this.primaryModel = config?.primaryModel || 'gemini-2.5-flash-image';
        this.fallbackModels = config?.fallbackModels || ['gemini-3.1-flash-image', 'gemini-3-pro-image'];
        this.timeoutMs = config?.timeoutMs || 60000;
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
1. "image_generate": Requesting to create a brand new image from a text description (e.g. "generate a picture of...", "create an image of...", "draw a...", "make wallpaper with...", "bhai photo bana").
2. "image_edit": Requesting to modify, edit, or transform an existing or uploaded image (e.g. "remove background", "change shirt color", "make it cinematic", "turn this into anime", "change background to a beach").
3. "chat": General text conversation, emotional sharing, questions, or asking questions about an uploaded image (e.g. "what is this?", "who is in this picture?", "can you explain this chart?").

Rules:
- If the user provided an image and is asking questions to understand it ("what is this?", "describe this"), classify as "chat".
- If the user asks to edit/alter an image (and either an image is uploaded now OR has recent image in history is true), classify as "image_edit".
- If the user asks to edit an image but no image was ever provided, classify as "image_edit" but note in refinedPrompt.
- If the user asks for image generation without an image, classify as "image_generate".
- For "image_generate" and "image_edit", generate a high-detail, vivid English "refinedPrompt" that captures all user instructions, visual details, style, composition, and lighting suitable for an image model.

Current user message: "${message}"
Has attached image right now: ${hasUploadedImage}
Has recent image in conversation history: ${hasRecentImageInHistory}

Respond strictly in valid JSON:
{
  "intent": "image_generate" | "image_edit" | "chat",
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
            if (parsed.intent && ['image_generate', 'image_edit', 'chat'].includes(parsed.intent)) {
                return {
                    intent: parsed.intent,
                    refinedPrompt: parsed.refinedPrompt || message,
                    confidence: parsed.confidence || 0.9
                };
            }
        }
        catch (e) {
            console.error('[ImageService] Intent classification error:', e);
        }
        // Heuristic fallback
        const lower = message.toLowerCase();
        const generateKeywords = ['generate', 'create image', 'draw', 'picture of', 'make an image', 'wallpaper', 'illustration of'];
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
     * Generate an image from a text prompt using Google Gemini image models.
     */
    async generateImage(prompt) {
        if (!this.ai) {
            return {
                success: false,
                error: 'Gemini API client is not configured. Missing GEMINI_API_KEY.',
                code: 'PROVIDER_ERROR',
                canRetry: false
            };
        }
        const candidateModels = [this.primaryModel, ...this.fallbackModels];
        let lastError = null;
        for (const model of candidateModels) {
            try {
                console.log(`[ImageService] Attempting image generation with model: ${model}`);
                const responsePromise = this.ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        responseModalities: ['IMAGE', 'TEXT']
                    }
                });
                // Apply timeout
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Image generation request timed out')), this.timeoutMs));
                const response = await Promise.race([responsePromise, timeoutPromise]);
                const candidate = response.candidates?.[0];
                if (!candidate) {
                    throw new Error('No candidate returned by Gemini image model');
                }
                const parts = candidate.content?.parts || [];
                let imageData;
                let mimeType;
                let textDescription;
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        imageData = part.inlineData.data;
                        mimeType = part.inlineData.mimeType || 'image/png';
                    }
                    else if (part.text) {
                        textDescription = (textDescription ? textDescription + '\n' : '') + part.text;
                    }
                }
                if (imageData) {
                    console.log(`[ImageService] Successfully generated image with ${model}! Bytes length: ${imageData.length}`);
                    return {
                        success: true,
                        data: imageData,
                        mimeType: mimeType || 'image/png',
                        textDescription
                    };
                }
                // If no inlineData but text returned, model may have refused or returned guidance
                if (textDescription) {
                    console.warn(`[ImageService] Model returned text instead of image: ${textDescription}`);
                    return {
                        success: false,
                        error: textDescription,
                        code: 'INVALID_INPUT',
                        canRetry: true
                    };
                }
                throw new Error('Model responded without image data');
            }
            catch (err) {
                lastError = err;
                console.error(`[ImageService] Error with model ${model}:`, err.message || err);
                // Check if error is quota exhaustion or safety block
                const errorInfo = this.normalizeError(err);
                if (errorInfo.code === 'QUOTA_EXCEEDED' || errorInfo.code === 'SAFETY_BLOCKED') {
                    // Do not attempt fallbacks for quota exhaustion or safety blocks
                    return {
                        success: false,
                        error: errorInfo.message,
                        code: errorInfo.code,
                        canRetry: errorInfo.canRetry
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
     * Edit an existing or uploaded image using instructions.
     */
    async editImage(instruction, originalImage) {
        if (!this.ai) {
            return {
                success: false,
                error: 'Gemini API client is not configured. Missing GEMINI_API_KEY.',
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
        const candidateModels = [this.primaryModel, ...this.fallbackModels];
        let lastError = null;
        for (const model of candidateModels) {
            try {
                console.log(`[ImageService] Attempting image edit with model: ${model}`);
                const contents = [
                    {
                        inlineData: {
                            data: originalImage.data,
                            mimeType: originalImage.mimeType
                        }
                    },
                    {
                        text: `Please edit this image according to the following instructions: ${instruction}. Return the edited image.`
                    }
                ];
                const responsePromise = this.ai.models.generateContent({
                    model,
                    contents,
                    config: {
                        responseModalities: ['IMAGE', 'TEXT']
                    }
                });
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Image edit request timed out')), this.timeoutMs));
                const response = await Promise.race([responsePromise, timeoutPromise]);
                const candidate = response.candidates?.[0];
                if (!candidate) {
                    throw new Error('No candidate returned by Gemini image editing model');
                }
                const parts = candidate.content?.parts || [];
                let imageData;
                let mimeType;
                let textDescription;
                for (const part of parts) {
                    if (part.inlineData?.data) {
                        imageData = part.inlineData.data;
                        mimeType = part.inlineData.mimeType || 'image/png';
                    }
                    else if (part.text) {
                        textDescription = (textDescription ? textDescription + '\n' : '') + part.text;
                    }
                }
                if (imageData) {
                    console.log(`[ImageService] Successfully edited image with ${model}! Bytes length: ${imageData.length}`);
                    return {
                        success: true,
                        data: imageData,
                        mimeType: mimeType || 'image/png',
                        textDescription
                    };
                }
                if (textDescription) {
                    console.warn(`[ImageService] Model returned text explanation instead of edited image: ${textDescription}`);
                    return {
                        success: false,
                        error: textDescription,
                        code: 'INVALID_INPUT',
                        canRetry: true
                    };
                }
                throw new Error('Model did not return edited image data');
            }
            catch (err) {
                lastError = err;
                console.error(`[ImageService] Edit error with model ${model}:`, err.message || err);
                const errorInfo = this.normalizeError(err);
                if (errorInfo.code === 'QUOTA_EXCEEDED' || errorInfo.code === 'SAFETY_BLOCKED') {
                    return {
                        success: false,
                        error: errorInfo.message,
                        code: errorInfo.code,
                        canRetry: errorInfo.canRetry
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
     * Normalize provider error codes and messages into clear user explanations.
     */
    normalizeError(error) {
        const msg = error?.message || String(error || '');
        const status = error?.status || error?.statusCode;
        if (status === 429 ||
            msg.includes('429') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('Quota exceeded') ||
            msg.includes('rate-limit')) {
            if (msg.includes('limit: 0') || msg.includes('free_tier')) {
                return {
                    code: 'QUOTA_EXCEEDED',
                    message: 'Google Gemini Image API quota limit reached. On Google AI Studio free-tier projects, image-output models have a limit of 0. To generate images with Gemini, please enable billing or upgrade your Google AI Studio project.',
                    canRetry: true
                };
            }
            return {
                code: 'QUOTA_EXCEEDED',
                message: 'Google Gemini Image API rate limit or quota exceeded. Please wait a few moments and try again.',
                canRetry: true
            };
        }
        if (msg.includes('safety') || msg.includes('SAFETY') || msg.includes('blocked') || msg.includes('HARM_CATEGORY')) {
            return {
                code: 'SAFETY_BLOCKED',
                message: 'The request was filtered by Google AI content safety guidelines. Please modify your prompt and try again.',
                canRetry: true
            };
        }
        if (msg.includes('timed out') || msg.includes('timeout')) {
            return {
                code: 'TIMEOUT',
                message: 'Image processing timed out. The model took too long to respond. Please try again.',
                canRetry: true
            };
        }
        if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('High demand')) {
            return {
                code: 'MODEL_UNAVAILABLE',
                message: 'The image generation service is temporarily under high demand. Please retry in a few moments.',
                canRetry: true
            };
        }
        return {
            code: 'PROVIDER_ERROR',
            message: msg || 'An unexpected error occurred while communicating with the image model.',
            canRetry: true
        };
    }
}
exports.ImageGenerationService = ImageGenerationService;
exports.imageService = new ImageGenerationService();
