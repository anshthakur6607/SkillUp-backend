/**
 * AI Chat Routes — server-side proxy for all AI provider calls.
 *
 * POST /api/ai/chat — chat with AI assistant (requires auth)
 *
 * SECURITY: All Gemini/Sarvam calls happen server-side.
 * API keys never reach the frontend.
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { aiChat } from '../controllers/aiChatController';

const router = Router();

router.post('/ai/chat', verifyAuth, aiChat);

export default router;
