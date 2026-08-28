/**
 * Integration Controller — HTTP endpoints for the integration layer.
 *
 * Endpoints:
 * ==========
 * POST /api/integrations/webhook/igot  — receive iGOT webhook events
 * POST /api/integrations/sync          — trigger a full sync (admin only)
 * GET  /api/integrations/status        — get sync status for all platforms
 * GET  /api/integrations/logs          — get recent sync logs (admin only)
 * GET  /api/integrations/tpac          — get upcoming NSSTA TPAC sessions
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { igotAdapter } from '../integrations/igotAdapter';
import { nsstaAdapter } from '../integrations/nsstaAdapter';
import { syncService } from '../integrations/syncService';
import { supabaseAnon } from '../config/supabaseClient';

/**
 * POST /api/integrations/webhook/igot
 *
 * Receives real-time events from iGOT Karmayogi.
 * iGOT sends a POST with event type and data payload.
 *
 * Example payloads:
 *   { event: "course.completed", user_id: "...", course_id: "...", score: 85 }
 *   { event: "course.enrolled", user_id: "...", course_id: "..." }
 *   { event: "course.progress_updated", user_id: "...", course_id: "...", progress_percent: 60 }
 */
export async function handleIGOTWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Verify webhook signature
    const signature = req.headers['x-igot-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);
    const isValid = await igotAdapter.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      return next(new AppError('Invalid webhook signature', 401));
    }

    const { event, ...data } = req.body;
    if (!event) {
      return next(new AppError('Missing event type in webhook payload', 400));
    }

    // Process the webhook asynchronously
    await igotAdapter.handleWebhook(event, data);

    // Respond immediately — don't make iGOT wait for our processing
    res.json({ status: 'ok', event });
  } catch (err) {
    next(new AppError('Webhook processing failed', 500));
  }
}

/**
 * POST /api/integrations/sync
 *
 * Triggers a full sync from all active platforms.
 * Admin-only endpoint. Can be called manually or by a cron job.
 */
export async function triggerSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await syncService.fullSync();
    res.json({
      status: 'ok',
      message: 'Sync completed',
      result,
    });
  } catch (err) {
    next(new AppError('Sync failed', 500));
  }
}

/**
 * GET /api/integrations/status
 *
 * Returns sync status for all configured platforms.
 */
export async function getSyncStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await syncService.getSyncStatus();
    res.json({ status: 'ok', data: status });
  } catch (err) {
    next(new AppError('Failed to fetch sync status', 500));
  }
}

/**
 * GET /api/integrations/logs
 *
 * Returns recent sync log entries (admin only).
 */
export async function getSyncLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const logs = await syncService.getRecentLogs(limit);
    res.json({ status: 'ok', data: logs });
  } catch (err) {
    next(new AppError('Failed to fetch sync logs', 500));
  }
}

/**
 * GET /api/integrations/tpac
 *
 * Returns upcoming NSSTA TPAC training sessions.
 * Public for authenticated users — they need to see what's available.
 */
export async function getTPACSessions(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, error } = await supabaseAnon
      .from('nssta_tpac_sessions')
      .select('*')
      .eq('is_active', true)
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(20);

    if (error) return next(new AppError('Failed to fetch TPAC sessions', 500));
    res.json({ status: 'ok', data: data || [] });
  } catch (err) {
    next(new AppError('Failed to fetch TPAC sessions', 500));
  }
}
