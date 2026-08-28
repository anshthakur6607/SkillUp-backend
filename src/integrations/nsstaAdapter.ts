/**
 * NSSTA TPAC Adapter — integration with the National Statistical System
 * Training Academy's Training Planning and Coordination calendar.
 *
 * WHAT IT DOES:
 * =============
 * 1. Pulls training session data from NSSTA TPAC
 * 2. Cross-references with iGOT self-paced courses for recommendations
 * 3. Provides the training calendar to the frontend
 *
 * NSSTA TPAC vs iGOT:
 * ====================
 * - iGOT: self-paced online courses (anytime, anywhere)
 * - NSSTA TPAC: classroom/hybrid training programs (scheduled, limited seats)
 *
 * The recommendation engine (future step) should consider both:
 *   - Urgent skill gap → suggest iGOT self-paced course (immediate)
 *   - Deep skill building → suggest NSSTA TPAC session (scheduled)
 *
 * HOW TO CONNECT TO REAL NSSTA API:
 * ===================================
 * NSSTA may expose data via:
 *   - Direct API (if available)
 *   - Web scraping (if no API — use a scheduled job)
 *   - Manual CSV upload (fallback for prototype)
 *
 * Store the config in platform_configs.config as JSON.
 */

import { PlatformAdapter } from './platformAdapter';
import type {
  ExternalCourse,
  ExternalEnrollment,
  ExternalCompletion,
  TPACSession,
} from './types';
import { supabaseServiceRole } from '../config/supabaseClient';

export class NSSTAAdapter extends PlatformAdapter {
  readonly platform = 'nssta_tpac' as const;

  async fetchCourses(): Promise<ExternalCourse[]> {
    const logId = await this.logSync({
      platform: 'nssta_tpac',
      direction: 'inbound',
      eventType: 'fetch_courses',
      status: 'pending',
    });

    try {
      // In production: fetch from NSSTA API or scrape their calendar
      // For prototype: return mock data
      const mockCourses: ExternalCourse[] = [
        {
          externalId: 'NSSTA-PRIV-201',
          title: 'Data Privacy in Government',
          description: 'Understanding the Digital Personal Data Protection Act and implementing safeguards.',
          url: 'https://nssta.gov.in/tpac/data-privacy-201',
          durationHours: 6,
          competencies: ['Data Privacy & Protection', 'Cybersecurity Awareness'],
          source: 'nssta_tpac',
        },
        {
          externalId: 'NSSTA-SURV-301',
          title: 'Advanced Survey Methods Workshop',
          description: '5-day intensive workshop on advanced sampling and estimation techniques.',
          url: 'https://nssta.gov.in/tpac/survey-advanced-301',
          durationHours: 40,
          competencies: ['Survey Design', 'Sampling Techniques', 'Statistical Inference'],
          source: 'nssta_tpac',
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

  async fetchEnrollments(_userId: string): Promise<ExternalEnrollment[]> {
    // TPAC sessions are managed through their portal, not our API
    return [];
  }

  async fetchCompletions(_since: Date): Promise<ExternalCompletion[]> {
    // Completions would be confirmed by NSSTA after the training
    return [];
  }

  async verifyWebhookSignature(_payload: string, _signature: string): Promise<boolean> {
    // NSSTA may not support webhooks — accept all
    return true;
  }

  /**
   * Fetch upcoming TPAC training sessions.
   * This is the main method — returns the training calendar.
   */
  async fetchTPACSessions(): Promise<TPACSession[]> {
    const logId = await this.logSync({
      platform: 'nssta_tpac',
      direction: 'inbound',
      eventType: 'fetch_tpac_sessions',
      status: 'pending',
    });

    try {
      // In production: fetch from NSSTA calendar API
      // For prototype: return mock sessions
      const mockSessions: TPACSession[] = [
        {
          externalId: 'TPAC-2026-001',
          title: 'National Workshop on Data Quality Assurance',
          description: 'Comprehensive workshop on data quality frameworks for national surveys.',
          trainingType: 'classroom',
          startDate: new Date('2026-09-15'),
          endDate: new Date('2026-09-19'),
          location: 'NSSTA Campus, New Delhi',
          capacity: 40,
          competencies: ['Data Quality Assurance', 'Survey Design'],
          targetDesignations: ['Statistical Officer', 'Deputy Director'],
          sourceUrl: 'https://nssta.gov.in/tpac/workshop-dq-2026',
        },
        {
          externalId: 'TPAC-2026-002',
          title: 'Python for Statistical Computing — Hands-on',
          description: '5-day hands-on training on Python for data analysis and visualization.',
          trainingType: 'hybrid',
          startDate: new Date('2026-10-06'),
          endDate: new Date('2026-10-10'),
          location: 'NSSTA Campus, New Delhi (also streamed online)',
          capacity: 60,
          competencies: ['Python Programming', 'Data Analysis & Interpretation'],
          targetDesignations: ['Assistant Director', 'Statistical Officer'],
          sourceUrl: 'https://nssta.gov.in/tpac/python-2026',
        },
        {
          externalId: 'TPAC-2026-003',
          title: 'Leadership Development Programme for Senior Officers',
          description: 'Executive-level programme for Joint Secretary and above.',
          trainingType: 'classroom',
          startDate: new Date('2026-11-03'),
          endDate: new Date('2026-11-07'),
          location: 'NSSTA Campus, New Delhi',
          capacity: 25,
          competencies: ['Leadership', 'Communication', 'Critical Thinking'],
          targetDesignations: ['Joint Secretary', 'Additional Secretary', 'Secretary'],
          sourceUrl: 'https://nssta.gov.in/tpac/leadership-2026',
        },
        {
          externalId: 'TPAC-2026-004',
          title: 'GIS and Remote Sensing for Statistical Applications',
          description: 'Field training on using GIS tools for geospatial data collection.',
          trainingType: 'field',
          startDate: new Date('2026-11-24'),
          endDate: new Date('2026-11-28'),
          location: 'Survey of India, Dehradun',
          capacity: 30,
          competencies: ['Data Engineering', 'Cloud Computing'],
          targetDesignations: ['Statistical Officer', 'Section Officer'],
          sourceUrl: 'https://nssta.gov.in/tpac/gis-2026',
        },
      ];

      await this.updateSyncLog(logId, 'success', mockSessions.length);
      return mockSessions;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateSyncLog(logId, 'failed', 0, msg);
      return [];
    }
  }

  /**
   * Sync TPAC sessions to the database.
   * Called periodically or manually.
   */
  async syncSessionsToDB(): Promise<number> {
    const sessions = await this.fetchTPACSessions();
    let synced = 0;

    for (const session of sessions) {
      const { error } = await supabaseServiceRole
        .from('nssta_tpac_sessions')
        .upsert(
          {
            external_id: session.externalId,
            title: session.title,
            description: session.description,
            training_type: session.trainingType,
            start_date: session.startDate.toISOString().split('T')[0],
            end_date: session.endDate?.toISOString().split('T')[0] || null,
            location: session.location,
            capacity: session.capacity,
            competencies: session.competencies,
            target_designations: session.targetDesignations,
            source_url: session.sourceUrl,
            is_active: true,
          },
          { onConflict: 'external_id' }
        );

      if (!error) synced++;
    }

    return synced;
  }
}

export const nsstaAdapter = new NSSTAAdapter();
