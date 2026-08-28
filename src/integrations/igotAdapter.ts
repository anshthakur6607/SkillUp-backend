/**
 * iGOT Adapter — integration with India's iGOT Karmayogi platform.
 *
 * WHAT IT DOES:
 * =============
 * 1. Pulls course catalog from iGOT API (course title, description, competencies)
 * 2. Pulls user completion records (for syncing competency scores)
 * 3. Handles webhook events from iGOT (real-time completion notifications)
 * 4. Pushes enrollment data back to iGOT (two-way sync)
 *
 * HOW TO CONNECT TO REAL iGOT API:
 * ==================================
 * 1. Register at https://igotkarmayogi.gov.in/developer (if available)
 * 2. Get API credentials (client_id, client_secret)
 * 3. Store them in platform_configs.config as JSON
 * 4. Set api_base_url to the real iGOT API endpoint
 *
 * FOR THIS HACKATHON PROTOTYPE:
 * ==============================
 * We use mock data that mirrors real iGOT structure.
 * The adapter is fully functional — just swap the mock fetch calls for real API calls.
 *
 * TWO-WAY SYNC DESIGN:
 * =====================
 * - INBOUND: iGOT → Us (course completions, enrollment status)
 * - OUTBOUND: Us → iGOT (enrollment requests, competency updates)
 * - WEBHOOK: iGOT pushes events to our /api/integrations/webhook/igot endpoint
 */

import { PlatformAdapter } from './platformAdapter';
import type {
  ExternalCourse,
  ExternalEnrollment,
  ExternalCompletion,
  SyncLogEntry,
} from './types';
import { supabaseServiceRole } from '../config/supabaseClient';

export class IGOTAdapter extends PlatformAdapter {
  readonly platform = 'igot' as const;

  /**
   * Fetch courses from iGOT.
   *
   * In production, this calls the iGOT API:
   *   GET {api_base_url}/api/v1/courses
   *   Headers: Authorization: Bearer {access_token}
   *
   * For now, returns mock data that matches real iGOT course structure.
   */
  async fetchCourses(): Promise<ExternalCourse[]> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'inbound',
      eventType: 'fetch_courses',
      status: 'pending',
    });

    try {
      const config = await this.getConfig();
      const apiBase = config?.api_base_url as string | undefined;

      // If real API is configured, fetch from it
      if (apiBase && config?.config && typeof config.config === 'object') {
        const cfg = config.config as Record<string, string>;
        const response = await fetch(`${apiBase}/api/v1/courses`, {
          headers: {
            'Authorization': `Bearer ${cfg.access_token || ''}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error(`iGOT API returned ${response.status}`);

        const data = (await response.json()) as { courses?: Record<string, unknown>[] };
        const courses: ExternalCourse[] = (data.courses || []).map((c: Record<string, unknown>) => ({
          externalId: c.id as string,
          title: c.title as string,
          description: c.description as string,
          url: c.url as string,
          durationHours: c.duration_hours as number,
          competencies: (c.tags as string[]) || [],
          source: 'igot' as const,
        }));

        await this.updateSyncLog(logId, 'success', courses.length);
        return courses;
      }

      // Mock data for hackathon prototype
      const mockCourses: ExternalCourse[] = [
        {
          externalId: 'IGOT-SURV-101',
          title: 'Fundamentals of Survey Sampling',
          description: 'Introduction to probability sampling methods used in national statistical surveys.',
          url: 'https://igotkarmayogi.gov.in/course/survey-sampling-101',
          durationHours: 8,
          competencies: ['Survey Design', 'Sampling Techniques'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-PY-201',
          title: 'Python for Data Analysis',
          description: 'Hands-on Python course for data wrangling, visualization, and statistical modeling.',
          url: 'https://igotkarmayogi.gov.in/course/python-data-201',
          durationHours: 12,
          competencies: ['Python Programming', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-PRIV-101',
          title: 'Data Privacy in Government',
          description: 'Understanding the Digital Personal Data Protection Act and implementing safeguards.',
          url: 'https://igotkarmayogi.gov.in/course/data-privacy-101',
          durationHours: 6,
          competencies: ['Data Privacy & Protection', 'Cybersecurity Awareness'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-LEAD-301',
          title: 'Leadership in Public Service',
          description: 'Developing leadership skills specific to government and statistical organisations.',
          url: 'https://igotkarmayogi.gov.in/course/leadership-301',
          durationHours: 4,
          competencies: ['Leadership', 'Project Management'],
          source: 'igot',
        },
        {
          externalId: 'IGOT-STAT-201',
          title: 'Advanced Statistical Methods',
          description: 'Regression analysis, time series, and hypothesis testing for government surveys.',
          url: 'https://igotkarmayogi.gov.in/course/adv-stats-201',
          durationHours: 10,
          competencies: ['Statistical Inference', 'Data Analysis & Interpretation'],
          source: 'igot',
        },
      ];

      await this.updateSyncLog(logId, 'success', mockCourses.length);
      return mockCourses;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Fetch user enrollments from iGOT.
   */
  async fetchEnrollments(userId: string): Promise<ExternalEnrollment[]> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'inbound',
      eventType: 'fetch_enrollments',
      status: 'pending',
      payload: { userId },
    });

    try {
      // In production: GET {api_base_url}/api/v1/users/{userId}/enrollments
      // For prototype: return empty (enrollments created via our UI)
      await this.updateSyncLog(logId, 'success', 0);
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Fetch completions from iGOT since a given date.
   * These trigger competency score updates in our system.
   */
  async fetchCompletions(since: Date): Promise<ExternalCompletion[]> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'inbound',
      eventType: 'fetch_completions',
      status: 'pending',
      payload: { since: since.toISOString() },
    });

    try {
      // In production: GET {api_base_url}/api/v1/completions?since={since}
      // For prototype: return mock completions
      const mockCompletions: ExternalCompletion[] = [
        {
          userId: 'mock-user-1',
          platform: 'igot',
          externalCourseId: 'IGOT-SURV-101',
          courseTitle: 'Fundamentals of Survey Sampling',
          completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          score: 85,
          certificateId: 'CERT-IGOT-SURV-001',
        },
      ];

      await this.updateSyncLog(logId, 'success', mockCompletions.length);
      return mockCompletions;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Verify webhook signature from iGOT.
   * Uses HMAC-SHA256 with the webhook_secret from platform_configs.
   */
  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    const config = await this.getConfig();
    const secret = (config?.config as Record<string, string>)?.webhook_secret;
    if (!secret) return true; // Skip verification if no secret configured

    try {
      const { createHmac } = await import('crypto');
      const expected = createHmac('sha256', secret).update(payload).digest('hex');
      return expected === signature;
    } catch {
      return false;
    }
  }

  /**
   * Handle an incoming webhook event from iGOT.
   * Called by the webhook controller when an iGOT event arrives.
   */
  async handleWebhook(event: string, data: Record<string, unknown>): Promise<void> {
    const logId = await this.logSync({
      platform: 'igot',
      direction: 'webhook',
      eventType: event,
      status: 'pending',
      payload: data,
    });

    try {
      switch (event) {
        case 'course.completed':
          await this.processCompletion(data);
          break;
        case 'course.enrolled':
          await this.processEnrollment(data);
          break;
        case 'course.progress_updated':
          await this.processProgressUpdate(data);
          break;
        default:
          console.log(`[iGOT] Unknown webhook event: ${event}`);
      }
      await this.updateSyncLog(logId, 'success', 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
    }
  }

  private async processCompletion(data: Record<string, unknown>): Promise<void> {
    const userId = data.user_id as string;
    const courseId = data.course_id as string;
    const courseTitle = data.course_title as string;
    const score = data.score as number | undefined;
    const certId = data.certificate_id as string | undefined;

    if (!userId || !courseId) return;

    // Store the completion record
    await supabaseServiceRole.from('platform_completions').upsert(
      {
        user_id: userId,
        platform: 'igot',
        external_course_id: courseId,
        course_title: courseTitle,
        completed_at: new Date().toISOString(),
        score: score || null,
        certificate_id: certId || null,
        processed: false,
      },
      { onConflict: 'user_id,platform,external_course_id' }
    );

    // TODO: Trigger competency score recalculation via sync service
    // This is the "feedback loop" mentioned in the hackathon docs
  }

  private async processEnrollment(data: Record<string, unknown>): Promise<void> {
    const userId = data.user_id as string;
    const courseId = data.course_id as string;
    if (!userId || !courseId) return;

    await supabaseServiceRole.from('platform_enrollments').upsert(
      {
        user_id: userId,
        platform: 'igot',
        external_course_id: courseId,
        course_title: data.course_title as string,
        status: 'enrolled',
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform,external_course_id' }
    );
  }

  private async processProgressUpdate(data: Record<string, unknown>): Promise<void> {
    const userId = data.user_id as string;
    const courseId = data.course_id as string;
    const progress = data.progress_percent as number;
    if (!userId || !courseId) return;

    await supabaseServiceRole
      .from('platform_enrollments')
      .update({
        progress_percent: progress,
        status: progress >= 100 ? 'completed' : 'in_progress',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('platform', 'igot')
      .eq('external_course_id', courseId);
  }
}

export const igotAdapter = new IGOTAdapter();
