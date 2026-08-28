/**
 * Integration Routes — webhook receivers, sync triggers, and platform status.
 *
 * Webhook routes (POST /api/integrations/webhook/*) do NOT use verifyAuth
 * because external platforms send these without our JWT tokens. Instead,
 * they verify the webhook signature (HMAC-SHA256) to prove authenticity.
 *
 * All other integration routes require authentication + admin role.
 */

import { Router } from 'express';
import { verifyAuth } from '../middleware/verifyAuth';
import { requireRole } from '../middleware/requireRole';
import {
  handleIGOTWebhook,
  triggerSync,
  getSyncStatus,
  getSyncLogs,
  getTPACSessions,
} from '../controllers/integrationController';

const router = Router();

/**
 * POST /api/integrations/webhook/igot
 * Receives real-time events from iGOT Karmayogi.
 * No auth — uses HMAC signature verification instead.
 */
router.post('/integrations/webhook/igot', handleIGOTWebhook);

/**
 * POST /api/integrations/sync
 * Triggers full sync from all active platforms.
 * Admin only.
 */
router.post('/integrations/sync', verifyAuth, requireRole('admin'), triggerSync);

/**
 * GET /api/integrations/status
 * Returns sync status for all platforms.
 * Admin only.
 */
router.get('/integrations/status', verifyAuth, requireRole('admin'), getSyncStatus);

/**
 * GET /api/integrations/logs
 * Returns recent sync log entries.
 * Admin only.
 */
router.get('/integrations/logs', verifyAuth, requireRole('admin'), getSyncLogs);

/**
 * GET /api/integrations/tpac
 * Returns upcoming NSSTA TPAC training sessions.
 * All authenticated users can see this (they need to know what's available).
 */
router.get('/integrations/tpac', verifyAuth, getTPACSessions);

export default router;
