/**
 * SyncService — orchestrates data flow between SkillUp and external platforms.
 *
 * THIS IS THE CORE OF THE INTEGRATION LAYER.
 *
 * Responsibilities:
 * =================
 * 1. Pull course data from iGOT and NSSTA TPAC
 * 2. Sync user completions → update competency scores
 * 3. Handle real-time webhook events
 * 4. Maintain the sync audit trail
 *
 * TWO-WAY SYNC FLOW:
 * ==================
 *
 *   ┌─────────┐    webhook/pull     ┌──────────────┐
 *   │  iGOT   │ ─────────────────→ │  SyncService  │
 *   └─────────┘                     └──────┬───────┘
 *                                          │
 *                                    ┌─────▼─────┐
 *                                    │ SkillUp DB │
 *                                    │ (profiles, │
 *                                    │  scores,   │
 *                                    │  logs)     │
 *                                    └─────┬─────┘
 *                                          │
 *                                    push/enroll
 *   ┌─────────┐ ←───────────────── ┌──────────────┐
 *   │ NSSTA   │    pull sessions   │  SyncService  │
 *   │ TPAC    │ ─────────────────→ │              │
 *   └─────────┘                     └──────────────┘
 *
 * COMPETENCY SCORE UPDATE LOGIC:
 * ==============================
 * When a course completion is received:
 *   1. Look up which competencies the course addresses (course_competencies)
 *   2. For each competency, update the user's score in user_competency_scores
 *   3. Use a weighted average: new_score = (old_score * weight + completion_score * (1-weight))
 *   4. This is the "feedback loop" mentioned in the hackathon docs
 */

import { igotAdapter } from './igotAdapter';
import { nsstaAdapter } from './nsstaAdapter';
import { supabaseServiceRole } from '../config/supabaseClient';
import type { PlatformType, ExternalCompletion } from './types';

export class SyncService {
  /**
   * Full sync — pull data from all active platforms.
   * Called by a scheduled job or manually from admin panel.
   */
  async fullSync(): Promise<{
    igot: { courses: number; completions: number };
    nssta: { sessions: number };
  }> {
    const result = {
      igot: { courses: 0, completions: 0 },
      nssta: { sessions: 0 },
    };

    // Sync iGOT courses
    const igotCourses = await igotAdapter.fetchCourses();
    for (const course of igotCourses) {
      await this.upsertCourse(course);
    }
    result.igot.courses = igotCourses.length;

    // Sync iGOT completions (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completions = await igotAdapter.fetchCompletions(since);
    for (const completion of completions) {
      await this.processCompletion(completion);
    }
    result.igot.completions = completions.length;

    // Sync NSSTA TPAC sessions
    const nsstaCount = await nsstaAdapter.syncSessionsToDB();
    result.nssta.sessions = nsstaCount;

    return result;
  }

  /**
   * Process a course completion — update competency scores.
   *
   * This is the KEY FEEDBACK LOOP:
   * completion → course_competencies → user_competency_scores
   *
   * The weighted average prevents one completion from completely overwriting
   * a user's existing competency assessment (which might have been based on
   * a more thorough evaluation).
   */
  async processCompletion(completion: ExternalCompletion): Promise<void> {
    if (!completion.userId) return;

    // Store the completion record
    await supabaseServiceRole.from('platform_completions').upsert(
      {
        user_id: completion.userId,
        platform: completion.platform,
        external_course_id: completion.externalCourseId,
        course_title: completion.courseTitle,
        completed_at: completion.completedAt.toISOString(),
        score: completion.score || null,
        certificate_id: completion.certificateId || null,
        processed: false,
      },
      { onConflict: 'user_id,platform,external_course_id' }
    );

    // Find the internal course ID
    const { data: course } = await supabaseServiceRole
      .from('courses')
      .select('id')
      .eq('source', completion.platform)
      .eq('external_id', completion.externalCourseId)
      .single();

    if (!course) return;

    // Get competencies addressed by this course
    const { data: courseComps } = await supabaseServiceRole
      .from('course_competencies')
      .select('competency_id')
      .eq('course_id', course.id);

    if (!courseComps || courseComps.length === 0) return;

    // Update competency scores (weighted average)
    const completionScore = completion.score || 80; // Default if no score
    const weight = 0.3; // Completion counts for 30% of the score

    for (const cc of courseComps) {
      const { data: existing } = await supabaseServiceRole
        .from('user_competency_scores')
        .select('id, score')
        .eq('user_id', completion.userId)
        .eq('competency_id', cc.competency_id)
        .single();

      if (existing) {
        // Weighted average: existing_score * 0.7 + completion_score * 0.3
        const newScore = Math.min(100, existing.score * (1 - weight) + completionScore * weight);
        await supabaseServiceRole
          .from('user_competency_scores')
          .update({
            score: Math.round(newScore * 10) / 10,
            last_assessed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // First assessment for this competency
        await supabaseServiceRole.from('user_competency_scores').insert({
          user_id: completion.userId,
          competency_id: cc.competency_id,
          score: completionScore,
          last_assessed_at: new Date().toISOString(),
        });
      }
    }

    // Mark as processed
    await supabaseServiceRole
      .from('platform_completions')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('user_id', completion.userId)
      .eq('platform', completion.platform)
      .eq('external_course_id', completion.externalCourseId);
  }

  /**
   * Upsert a course from an external platform into our courses table.
   */
  private async upsertCourse(course: {
    externalId: string;
    title: string;
    description?: string;
    url?: string;
    durationHours?: number;
    competencies: string[];
    source: PlatformType;
  }): Promise<void> {
    const { data: existing } = await supabaseServiceRole
      .from('courses')
      .select('id')
      .eq('source', course.source)
      .eq('external_id', course.externalId)
      .single();

    if (existing) {
      // Update existing course
      await supabaseServiceRole
        .from('courses')
        .update({
          title: course.title,
          description: course.description || null,
          external_url: course.url || null,
          duration_hours: course.durationHours || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new course
      const { data: newCourse } = await supabaseServiceRole
        .from('courses')
        .insert({
          title: course.title,
          description: course.description || null,
          source: course.source,
          external_id: course.externalId,
          external_url: course.url || null,
          duration_hours: course.durationHours || null,
        })
        .select('id')
        .single();

      // Link competencies
      if (newCourse) {
        for (const compName of course.competencies) {
          const { data: comp } = await supabaseServiceRole
            .from('competencies')
            .select('id')
            .eq('name', compName)
            .single();

          if (comp) {
            await supabaseServiceRole.from('course_competencies').insert({
              course_id: newCourse.id,
              competency_id: comp.id,
            });
          }
        }
      }
    }
  }

  /**
   * Get sync status for all platforms.
   */
  async getSyncStatus(): Promise<Record<string, unknown>[]> {
    const { data } = await supabaseServiceRole
      .from('platform_configs')
      .select('*')
      .order('platform');

    return data || [];
  }

  /**
   * Get recent sync logs.
   */
  async getRecentLogs(limit: number = 20): Promise<Record<string, unknown>[]> {
    const { data } = await supabaseServiceRole
      .from('integration_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}

export const syncService = new SyncService();
