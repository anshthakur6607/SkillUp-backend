/**
 * Health check route definition.
 *
 * This file maps HTTP methods and paths to controller functions.
 * By separating route definitions from route handlers (controllers),
 * we keep the code organized and easy to maintain as the project grows.
 */

import { Router } from 'express';
import { healthCheck } from '../controllers/healthController';

const router = Router();

/**
 * GET /api/health
 * Returns { status: "ok", timestamp: "..." } if the server is running.
 * This is mounted at /api in app.ts, so the full path is /api/health.
 */
router.get('/health', healthCheck);

export default router;
