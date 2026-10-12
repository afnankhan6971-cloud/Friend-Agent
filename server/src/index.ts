import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import chatRoutes from './routes/chat';
import conversationsRoutes from './routes/conversations';
import memoryRoutes from './routes/memories';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/memories', memoryRoutes);

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
