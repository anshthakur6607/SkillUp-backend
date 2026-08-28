/**
 * PlatformAdapter — abstract base class for external platform integrations.
 *
 * WHY AN ADAPTER PATTERN?
 * ========================
 * This project needs to integrate with multiple platforms:
 *   - iGOT Karmayogi (courses, completions)
 *   - NSSTA TPAC (training calendar)
 *   - Future: DIKSHA, SWAYAM, e-HRMS/SPARROW
 *
 * The adapter pattern lets us:
 *   1. Add new platforms by just adding a new adapter class (no changes to sync service)
 *   2. Swap implementations without changing the rest of the codebase
 *   3. Test with mock adapters during development
 *
 * Each adapter implements the same interface, so the SyncService doesn't care
 * which platform it's talking to — it just calls the generic methods.
 */

import type {
  PlatformType,
  ExternalCourse,
  ExternalEnrollment,
  ExternalCompletion,
  TPACSession,
  SyncLogEntry,
} from './types';
import { supabaseServiceRole } from '../config/supabaseClient';

export abstract class PlatformAdapter {
  abstract readonly platform: PlatformType;

  /**
   * Fetch courses from the external platform.
   * Implementations handle platform-specific API calls, pagination, auth, etc.
   */
  abstract fetchCourses(): Promise<ExternalCourse[]>;

  /**
   * Fetch enrollments for a specific user from the external platform.
   */
  abstract fetchEnrollments(userId: string): Promise<ExternalEnrollment[]>;

  /**
   * Fetch completions since a given date (for incremental sync).
   */
  abstract fetchCompletions(since: Date): Promise<ExternalCompletion[]>;

  /**
   * Verify a webhook signature. Return true if valid.
   * Platforms that don't support webhooks can return true (skip verification).
   */
  abstract verifyWebhookSignature(payload: string, signature: string): Promise<boolean>;

  // =========================================================================
  // Common methods — shared across all adapters
  // =========================================================================

  /**
   * Log a sync event to the integration_logs table.
   * Every sync operation MUST log — this is the audit trail.
   */
  async logSync(entry: SyncLogEntry): Promise<string> {
    const { data, error } = await supabaseServiceRole
      .from('integration_logs')
      .insert({
        platform: entry.platform,
        direction: entry.direction,
        event_type: entry.eventType,
        status: entry.status,
        payload: entry.payload || {},
        error_message: entry.errorMessage || null,
        records_affected: entry.recordsAffected || 0,
        completed_at: entry.status !== 'pending' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[Integration] Failed to log sync event:`, error.message);
      return '';
    }
    return data?.id || '';
  }

  /**
   * Update sync status for a previously logged event.
   */
  async updateSyncLog(
    logId: string,
    status: SyncStatus,
    recordsAffected: number,
    errorMessage?: string
  ): Promise<void> {
    if (!logId) return;
    await supabaseServiceRole
      .from('integration_logs')
      .update({
        status,
        records_affected: recordsAffected,
        error_message: errorMessage || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId);
  }

  /**
   * Upsert platform config (used during setup/initialization).
   */
  async upsertConfig(config: {
    display_name: string;
    api_base_url?: string;
    is_active?: boolean;
    config?: Record<string, unknown>;
  }): Promise<void> {
    await supabaseServiceRole
      .from('platform_configs')
      .upsert(
        { platform: this.platform, ...config },
        { onConflict: 'platform' }
      );
  }

  /**
   * Get platform config.
   */
  async getConfig(): Promise<Record<string, unknown> | null> {
    const { data } = await supabaseServiceRole
      .from('platform_configs')
      .select('*')
      .eq('platform', this.platform)
      .single();
    return data;
  }

  /**
   * Check if this platform is active.
   */
  async isActive(): Promise<boolean> {
    const config = await this.getConfig();
    return config?.is_active === true;
  }
}

type SyncStatus = 'pending' | 'success' | 'failed' | 'partial';
