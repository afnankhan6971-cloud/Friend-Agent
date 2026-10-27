"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const chat_1 = __importDefault(require("./routes/chat"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const memories_1 = __importDefault(require("./routes/memories"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/chat', chat_1.default);
app.use('/api/conversations', conversations_1.default);
app.use('/api/memories', memories_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        replicateConfigured: Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN.trim().length > 0)
    });
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`[Config] Replicate token configured: ${Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_API_TOKEN.trim().length > 0)}`);
});
