"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_1 = require("../services/ai");
const imageGeneration_1 = require("../services/imageGeneration");
const storage_1 = require("../services/storage");
const db_1 = require("../services/db");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
// In-flight active image requests tracker to prevent duplicate concurrent requests
const activeImageRequests = new Set();
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
const upload = (0, multer_1.default)({
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'));
        }
    }
});
router.post('/', (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.warn('[CHAT] Upload error:', err.message);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: `File too large. Maximum supported size is 10MB.` });
            }
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { message, conversationId, history, personality } = req.body;
        const userMessageText = typeof message === 'string' ? message.trim() : '';
        let parsedHistory = [];
        if (history) {
            try {
                parsedHistory = typeof history === 'string' ? JSON.parse(history) : history;
            }
            catch (e) {
                parsedHistory = [];
            }
        }
        const userId = req.user.id;
        const token = req.token;
        const userDb = (0, db_1.getAuthClient)(token) || db_1.supabase;
        let imageObj;
        if (req.file) {
            imageObj = {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString('base64')
            };
        }
        if (!userMessageText && !imageObj) {
            return res.status(400).json({ error: 'Message text or image is required.' });
        }
        // Check if conversation history has any recent image
        const hasRecentImageInHistory = parsedHistory.some(m => m.imageUrl || m.message_type === 'image');
        // 1. Intent Classification
        const intentResult = await imageGeneration_1.imageService.classifyIntent(userMessageText, !!imageObj, hasRecentImageInHistory);
        console.log(`[CHAT] Intent detected: ${intentResult.intent} (confidence: ${intentResult.confidence})`);
        let conversationTitle = "";
        if (userDb && conversationId) {
            const { data: convData } = await userDb
                .from('conversations')
                .select('title')
                .eq('id', conversationId)
                .eq('user_id', userId)
                .single();
            if (convData)
                conversationTitle = convData.title;
        }
        // Setup SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // --- CASE 0: IMAGE CAPABILITY QUESTION ---
        if (intentResult.intent === 'image_capability') {
            const capInfo = imageGeneration_1.imageService.getCapabilityStatus();
            console.log(`[CHAT] Handling image_capability query. Current capability status: ${capInfo.status}`);
            // 1. Emotion Analysis for matching conversational tone
            const emotion = await ai_1.aiProvider.analyzeEmotion(userMessageText, parsedHistory, imageObj);
            // 2. Save user message to DB
            let userMsgId = null;
            if (userDb && conversationId) {
                const { data: insertedUserMsg } = await userDb.from('messages').insert({
                    conversation_id: conversationId,
                    role: 'user',
                    content: userMessageText,
                    message_type: 'text'
                }).select('id').single();
                if (insertedUserMsg)
                    userMsgId = insertedUserMsg.id;
            }
            // 3. Generate and stream capability explanation
            let fullResponse = "";
            try {
                await ai_1.aiProvider.generateStreamingResponse(userMessageText, parsedHistory, emotion, [], imageObj, personality || 'listener', (chunk) => {
                    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
                    fullResponse += chunk;
                }, {
                    type: 'image_capability',
                    status: capInfo.status,
                    detail: capInfo.detail
                });
            }
            catch (e) {
                console.error('[AI] Generation Stream Error for image_capability:', e);
                if (!fullResponse) {
                    if (capInfo.status === 'operational') {
                        fullResponse = 'Haan bilkul! Main images generate aur edit kar sakta hoon. Aap batayein kya banana hai!';
                    }
                    else if (capInfo.status === 'unavailable_quota') {
                        fullResponse = 'Haan, mere paas image create karne ka feature to hai, lekin abhi API quota limit ki wajah se image generation temporarily unavailable hai. Normal chat bina kisi dikkat ke chal rahi hai!';
                    }
                    else if (capInfo.status === 'not_configured') {
                        fullResponse = 'Image generation feature is supported, but it is not configured yet.';
                    }
                    else {
                        fullResponse = 'Image generation feature is temporarily unavailable due to a service error.';
                    }
                    res.write(`data: ${JSON.stringify({ chunk: fullResponse })}\n\n`);
                }
            }
            // 4. Save Assistant Message to DB
            if (userDb && conversationId && fullResponse) {
                await userDb.from('messages').insert({
                    conversation_id: conversationId,
                    role: 'assistant',
                    content: fullResponse,
                    message_type: 'text'
                });
            }
            res.write(`data: [DONE]\n\n`);
            res.end();
            // Trigger title update if new chat
            if (userDb && conversationId && conversationTitle === 'New Chat') {
                triggerTitleUpdate(userDb, conversationId, userId, userMessageText);
            }
            return;
        }
        // --- CASE A: IMAGE GENERATION ---
        if (intentResult.intent === 'image_generate') {
            const promptToUse = intentResult.refinedPrompt || userMessageText;
            const dedupeKey = `${userId}:generate:${promptToUse.trim().toLowerCase()}`;
            if (activeImageRequests.has(dedupeKey)) {
                console.warn(`[CHAT] Duplicate image generation request blocked: "${promptToUse}"`);
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'An image request is already currently in progress. Please wait for it to complete.',
                    canRetry: false
                })}\n\n`);
                res.write(`data: [DONE]\n\n`);
                res.end();
                return;
            }
            activeImageRequests.add(dedupeKey);
            try {
                res.write(`data: ${JSON.stringify({ type: 'status', status: 'generating_image', message: 'Generating image...' })}\n\n`);
                // 1. Save user message to DB
                let userMsgId = null;
                if (userDb && conversationId) {
                    const { data: insertedUserMsg } = await userDb.from('messages').insert({
                        conversation_id: conversationId,
                        role: 'user',
                        content: userMessageText,
                        message_type: 'text'
                    }).select('id').single();
                    if (insertedUserMsg)
                        userMsgId = insertedUserMsg.id;
                }
                // 2. Call image generation service
                console.log(`[AI] Generating image with prompt: "${promptToUse}"`);
                const genResult = await imageGeneration_1.imageService.generateImage(promptToUse);
                if (genResult.success && genResult.data) {
                    let displayUrl = `data:${genResult.mimeType || 'image/png'};base64,${genResult.data}`;
                    let storageFilePath;
                    // Persist to Supabase Storage if userDb and conversationId exist
                    if (userDb && conversationId) {
                        const uploadRes = await (0, storage_1.uploadImageToStorage)(userDb, userId, conversationId, 'generated', genResult.data, genResult.mimeType || 'image/png');
                        if (uploadRes.success && uploadRes.filePath) {
                            storageFilePath = uploadRes.filePath;
                            if (uploadRes.url)
                                displayUrl = uploadRes.url;
                        }
                    }
                    // Save assistant message to DB
                    const assistantText = genResult.textDescription || `Here is your generated image based on: "${promptToUse}"`;
                    let assistantMsgId = null;
                    if (userDb && conversationId) {
                        const { data: insertedAsstMsg } = await userDb.from('messages').insert({
                            conversation_id: conversationId,
                            role: 'assistant',
                            content: assistantText,
                            message_type: 'image'
                        }).select('id').single();
                        if (insertedAsstMsg)
                            assistantMsgId = insertedAsstMsg.id;
                        // Save attachment reference if storage succeeded
                        if (assistantMsgId && storageFilePath) {
                            await userDb.from('attachments').insert({
                                message_id: assistantMsgId,
                                file_path: storageFilePath,
                                file_type: genResult.mimeType || 'image/png'
                            });
                        }
                    }
                    // Send SSE response
                    res.write(`data: ${JSON.stringify({
                        type: 'image',
                        imageUrl: displayUrl,
                        prompt: promptToUse,
                        content: assistantText,
                        status: 'completed'
                    })}\n\n`);
                    res.write(`data: ${JSON.stringify({ chunk: assistantText })}\n\n`);
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    // Trigger smart title generation if new chat
                    if (userDb && conversationId && conversationTitle === 'New Chat') {
                        triggerTitleUpdate(userDb, conversationId, userId, promptToUse);
                    }
                    return;
                }
                else {
                    // Generation Failed
                    console.warn(`[AI] Image generation failed:`, genResult.error);
                    const errorMessage = genResult.error || 'Failed to generate image.';
                    // Record clean failure in DB so conversation reflects the exchange without technical dumps
                    if (userDb && conversationId) {
                        await userDb.from('messages').insert({
                            conversation_id: conversationId,
                            role: 'assistant',
                            content: errorMessage,
                            message_type: 'text'
                        });
                    }
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: errorMessage,
                        code: genResult.code,
                        canRetry: genResult.canRetry === true,
                        retryPayload: genResult.canRetry === true ? { prompt: userMessageText, mode: 'generate' } : undefined
                    })}\n\n`);
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    return;
                }
            }
            finally {
                activeImageRequests.delete(dedupeKey);
            }
        }
        // --- CASE B: IMAGE EDITING ---
        if (intentResult.intent === 'image_edit') {
            const editInstruction = intentResult.refinedPrompt || userMessageText;
            const dedupeKey = `${userId}:edit:${editInstruction.trim().toLowerCase()}`;
            if (activeImageRequests.has(dedupeKey)) {
                console.warn(`[CHAT] Duplicate image edit request blocked: "${editInstruction}"`);
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'An image editing request is already currently in progress. Please wait for it to complete.',
                    canRetry: false
                })}\n\n`);
                res.write(`data: [DONE]\n\n`);
                res.end();
                return;
            }
            activeImageRequests.add(dedupeKey);
            try {
                res.write(`data: ${JSON.stringify({ type: 'status', status: 'editing_image', message: 'Editing image...' })}\n\n`);
                // Determine source image to edit
                let sourceImage = imageObj;
                let originalImageUrlForDisplay = imageObj ? `data:${imageObj.mimeType};base64,${imageObj.data}` : undefined;
                // If no image uploaded in this turn, check history for most recent image
                if (!sourceImage && hasRecentImageInHistory) {
                    for (let i = parsedHistory.length - 1; i >= 0; i--) {
                        const item = parsedHistory[i];
                        if (item.imageUrl) {
                            originalImageUrlForDisplay = item.imageUrl;
                            break;
                        }
                    }
                }
                if (!sourceImage) {
                    const noImageMsg = "To edit an image, please upload or attach the image you would like to edit.";
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: noImageMsg,
                        canRetry: false
                    })}\n\n`);
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    return;
                }
                // Save user message and original attachment
                let userMsgId = null;
                let originalStoragePath;
                if (userDb && conversationId) {
                    const { data: insertedUserMsg } = await userDb.from('messages').insert({
                        conversation_id: conversationId,
                        role: 'user',
                        content: userMessageText || 'Edit this image',
                        message_type: 'image'
                    }).select('id').single();
                    if (insertedUserMsg)
                        userMsgId = insertedUserMsg.id;
                    // Persist original uploaded image to storage
                    if (req.file && userMsgId) {
                        const origUpload = await (0, storage_1.uploadImageToStorage)(userDb, userId, conversationId, 'upload', req.file.buffer, req.file.mimetype);
                        if (origUpload.success && origUpload.filePath) {
                            originalStoragePath = origUpload.filePath;
                            if (origUpload.url)
                                originalImageUrlForDisplay = origUpload.url;
                            await userDb.from('attachments').insert({
                                message_id: userMsgId,
                                file_path: origUpload.filePath,
                                file_type: req.file.mimetype
                            });
                        }
                    }
                }
                console.log(`[AI] Editing image with instruction: "${editInstruction}"`);
                const editResult = await imageGeneration_1.imageService.editImage(editInstruction, sourceImage);
                if (editResult.success && editResult.data) {
                    let editedDisplayUrl = `data:${editResult.mimeType || 'image/png'};base64,${editResult.data}`;
                    let editedStoragePath;
                    if (userDb && conversationId) {
                        const uploadRes = await (0, storage_1.uploadImageToStorage)(userDb, userId, conversationId, 'edited', editResult.data, editResult.mimeType || 'image/png');
                        if (uploadRes.success && uploadRes.filePath) {
                            editedStoragePath = uploadRes.filePath;
                            if (uploadRes.url)
                                editedDisplayUrl = uploadRes.url;
                        }
                    }
                    const assistantText = editResult.textDescription || `Here is your edited image: ${editInstruction}`;
                    let assistantMsgId = null;
                    if (userDb && conversationId) {
                        const { data: insertedAsstMsg } = await userDb.from('messages').insert({
                            conversation_id: conversationId,
                            role: 'assistant',
                            content: assistantText,
                            message_type: 'image'
                        }).select('id').single();
                        if (insertedAsstMsg)
                            assistantMsgId = insertedAsstMsg.id;
                        if (assistantMsgId && editedStoragePath) {
                            await userDb.from('attachments').insert({
                                message_id: assistantMsgId,
                                file_path: editedStoragePath,
                                file_type: editResult.mimeType || 'image/png'
                            });
                        }
                    }
                    res.write(`data: ${JSON.stringify({
                        type: 'image',
                        imageUrl: editedDisplayUrl,
                        originalImageUrl: originalImageUrlForDisplay,
                        isEdited: true,
                        prompt: editInstruction,
                        content: assistantText,
                        status: 'completed'
                    })}\n\n`);
                    res.write(`data: ${JSON.stringify({ chunk: assistantText })}\n\n`);
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    if (userDb && conversationId && conversationTitle === 'New Chat') {
                        triggerTitleUpdate(userDb, conversationId, userId, editInstruction);
                    }
                    return;
                }
                else {
                    // Editing Failed
                    console.warn(`[AI] Image editing failed:`, editResult.error);
                    const errorMessage = editResult.error || 'Failed to edit image.';
                    if (userDb && conversationId) {
                        await userDb.from('messages').insert({
                            conversation_id: conversationId,
                            role: 'assistant',
                            content: errorMessage,
                            message_type: 'text'
                        });
                    }
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: errorMessage,
                        code: editResult.code,
                        canRetry: editResult.canRetry === true,
                        retryPayload: editResult.canRetry === true ? { prompt: userMessageText, mode: 'edit' } : undefined
                    })}\n\n`);
                    res.write(`data: [DONE]\n\n`);
                    res.end();
                    return;
                }
            }
            finally {
                activeImageRequests.delete(dedupeKey);
            }
        }
        // --- CASE C: ORDINARY CHAT & IMAGE UNDERSTANDING ---
        // 1. Fetch user memories
        let allMemories = [];
        if (userDb) {
            const { data: memData } = await userDb
                .from('memories')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100);
            if (memData)
                allMemories = memData;
        }
        // 2. Emotion Analysis
        const emotion = await ai_1.aiProvider.analyzeEmotion(userMessageText, parsedHistory, imageObj);
        // 3. Save User Message & uploaded attachment if present
        let userMsgId = null;
        if (userDb && conversationId) {
            const { data: insertedUserMsg } = await userDb.from('messages').insert({
                conversation_id: conversationId,
                role: 'user',
                content: userMessageText,
                message_type: imageObj ? 'image' : 'text'
            }).select('id').single();
            if (insertedUserMsg)
                userMsgId = insertedUserMsg.id;
            if (req.file && userMsgId) {
                const origUpload = await (0, storage_1.uploadImageToStorage)(userDb, userId, conversationId, 'upload', req.file.buffer, req.file.mimetype);
                if (origUpload.success && origUpload.filePath) {
                    await userDb.from('attachments').insert({
                        message_id: userMsgId,
                        file_path: origUpload.filePath,
                        file_type: req.file.mimetype
                    });
                }
            }
        }
        // 4. Memory Context Processing
        let activeMemories = [];
        if (userDb) {
            const memoryResult = await ai_1.aiProvider.processMemoryContext(userMessageText, parsedHistory, allMemories);
            for (const op of memoryResult.operations) {
                if (op.action === 'INSERT' && op.content) {
                    const { data } = await userDb.from('memories').insert({
                        user_id: userId,
                        memory: op.content,
                        category: op.category || 'personal_context',
                        importance: op.importance || 3
                    }).select().single();
                    if (data && memoryResult.retrieved_memory_ids.length < 5) {
                        activeMemories.push(data);
                    }
                }
                else if (op.action === 'UPDATE' && op.id && op.content) {
                    await userDb.from('memories').update({
                        memory: op.content,
                        category: op.category,
                        importance: op.importance
                    }).eq('id', op.id).eq('user_id', userId);
                }
                else if (op.action === 'DELETE' && op.id) {
                    await userDb.from('memories').delete().eq('id', op.id).eq('user_id', userId);
                }
            }
            for (const id of memoryResult.retrieved_memory_ids) {
                const m = allMemories.find(m => m.id === id);
                if (m && !memoryResult.operations.some(op => op.action === 'DELETE' && op.id === id)) {
                    if (!activeMemories.some(active => active.id === id)) {
                        activeMemories.push(m);
                    }
                }
            }
        }
        // 5. Generate Streaming Response
        let fullResponse = "";
        try {
            console.log('[AI] Generating streaming response with Gemini');
            await ai_1.aiProvider.generateStreamingResponse(userMessageText, parsedHistory, emotion, activeMemories, imageObj, personality || 'listener', (chunk) => {
                res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
                fullResponse += chunk;
            });
        }
        catch (e) {
            console.error("[AI] Generation Stream Error:", e);
            if (fullResponse === "") {
                return res.status(500).json({ error: "Failed to generate AI response." });
            }
        }
        // 6. Save Assistant Message
        if (userDb && conversationId && fullResponse) {
            await userDb.from('messages').insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: fullResponse,
                message_type: 'text'
            });
        }
        res.write(`data: [DONE]\n\n`);
        res.end();
        // 7. Title Generation
        if (userDb && conversationId && conversationTitle === 'New Chat') {
            triggerTitleUpdate(userDb, conversationId, userId, userMessageText);
        }
    }
    catch (error) {
        console.error('Chat error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process chat' });
        }
        else {
            res.end();
        }
    }
});
function triggerTitleUpdate(userDb, conversationId, userId, promptText) {
    ai_1.aiProvider.generateConversationTitle(promptText).then(async (newTitle) => {
        let finalTitle = newTitle;
        if (!finalTitle || finalTitle === 'New Chat') {
            finalTitle = promptText.split(/[.?!]/)[0].substring(0, 40).trim();
            if (!finalTitle)
                finalTitle = "New Conversation";
        }
        await userDb.from('conversations').update({ title: finalTitle }).eq('id', conversationId).eq('user_id', userId);
    }).catch(async (e) => {
        console.error("Title generation failed:", e);
        let fallbackTitle = promptText.split(/[.?!]/)[0].substring(0, 40).trim();
        if (!fallbackTitle)
            fallbackTitle = "New Conversation";
        await userDb.from('conversations').update({ title: fallbackTitle }).eq('id', conversationId).eq('user_id', userId);
    });
}
exports.default = router;
