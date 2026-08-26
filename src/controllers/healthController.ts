/**
 * Health check controller.
 *
 * This is the handler for the GET /api/health endpoint.
 * Its only job is to confirm the server is running, the middleware chain
 * is working, and the Supabase client was initialized successfully.
 *
 * It does NOT query the database or perform any real work — it's just
 * a basic "ping" to verify the system is alive.
 */

import { Request, Response } from 'express';
import { HealthCheckResponse } from '../types/responses';

/**
 * Handle the health check request.
 *
 * Returns a simple JSON object with a status and timestamp.
 * If this endpoint responds, it means:
 *   - The Express server started successfully
 *   - All middleware (helmet, cors, rate limiting, etc.) is wired up
 *   - The Supabase client was initialized without errors
 *   - The route is mounted correctly
 */
export const healthCheck = (_req: Request, res: Response): void => {
  const response: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
};
