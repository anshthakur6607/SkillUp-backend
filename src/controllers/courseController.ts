/**
 * Course Controller
 *
 * Handles course listing, detail view, enrollment, and dummy course monitoring.
 *
 * Dummy monitoring system:
 * - When a user enrolls in a course, we create an enrollment row with status='not_started'
 * - When they "start" the course, status changes to 'in_progress' with started_at = now
 * - A timer runs server-side that auto-advances progress_percent based on duration_hours
 * - When progress reaches 100%, status becomes 'completed' and completed_at is set
 * - This simulates real iGOT course completion tracking for the hackathon demo
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseServiceRole } from '../config/supabaseClient';
import { AppError } from '../middleware/errorHandler';

// ─── GET ALL ACTIVE COURSES ──────────────────────────────────────────────────
export async function getAllCourses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { source, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseServiceRole
      .from('courses')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('title', { ascending: true });

    if (source && typeof source === 'string') {
      query = query.eq('source', source);
    }
    if (search && typeof search === 'string') {
      query = query.ilike('title', `%${search}%`);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      return next(new AppError('Failed to fetch courses', 500));
    }

    res.json({
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch {
    next(new AppError('Failed to fetch courses', 500));
  }
}

// ─── GET SINGLE COURSE ───────────────────────────────────────────────────────
export async function getCourseById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseServiceRole
      .from('courses')
      .select(`
        *,
        course_competencies (
          competencies ( id, name, description, domain_id )
        )
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return next(new AppError('Course not found', 404));
    }

    // If user is logged in, get their enrollment status
    let enrollment = null;
    if (req.user) {
      const { data: enrollData } = await supabaseServiceRole
        .from('enrollments')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('course_id', id)
        .single();
      enrollment = enrollData;
    }

    res.json({ data, enrollment });
  } catch {
    next(new AppError('Failed to fetch course', 500));
  }
}

// ─── ENROLL IN COURSE ────────────────────────────────────────────────────────
export async function enrollInCourse(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { courseId } = req.params;
    const userId = req.user.id;

    // Check if already enrolled
    const { data: existing } = await supabaseServiceRole
      .from('enrollments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (existing) {
      // Already enrolled — return existing enrollment
      res.json({ data: existing, message: 'Already enrolled' });
      return;
    }

    // Create enrollment
    const { data, error } = await supabaseServiceRole
      .from('enrollments')
      .insert({
        user_id: userId,
        course_id: courseId,
        status: 'not_started',
        progress_percent: 0,
      })
      .select()
      .single();

    if (error) {
      return next(new AppError('Failed to enroll', 500));
    }

    res.status(201).json({ data, message: 'Enrolled successfully' });
  } catch {
    next(new AppError('Failed to enroll', 500));
  }
}

// ─── START / PROGRESS COURSE (Dummy Monitoring) ──────────────────────────────
/**
 * Dummy course monitoring system.
 *
 * When user starts a course:
 * - Status → 'in_progress', started_at = now
 * - Progress auto-advances based on course duration:
 *   - Short courses (≤2h): complete in 10 seconds for demo
 *   - Medium courses (2-8h): complete in 30 seconds
 *   - Long courses (>8h): complete in 60 seconds
 * - On complete: status → 'completed', completed_at = now, generates certificate
 *
 * The progress is calculated on-the-fly when the user polls their enrollment,
 * using the elapsed time since started_at vs the target duration.
 * No background process needed — pure timestamp math.
 */
export async function startCourse(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { courseId } = req.params;
    const userId = req.user.id;

    // Get enrollment
    const { data: enrollment, error: enrollErr } = await supabaseServiceRole
      .from('enrollments')
      .select('*, courses!inner(id, duration_hours, title)')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (enrollErr || !enrollment) {
      return next(new AppError('Not enrolled in this course. Enroll first.', 400));
    }

    // If already completed, just return
    if (enrollment.status === 'completed') {
      res.json({ data: enrollment, message: 'Course already completed' });
      return;
    }

    // If not started yet, mark as in_progress
    if (enrollment.status === 'not_started' || !enrollment.started_at) {
      const { error: updateErr } = await supabaseServiceRole
        .from('enrollments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);

      if (updateErr) {
        return next(new AppError('Failed to start course', 500));
      }
    }

    // Re-fetch to get updated row
    const { data: updated } = await supabaseServiceRole
      .from('enrollments')
      .select('*, courses!inner(id, duration_hours, title)')
      .eq('id', enrollment.id)
      .single();

    res.json({ data: updated, message: 'Course started' });
  } catch {
    next(new AppError('Failed to start course', 500));
  }
}

// ─── GET ENROLLMENT STATUS (with auto-progress calculation) ──────────────────
/**
 * Returns the current enrollment with computed progress_percent.
 *
 * Progress is calculated from timestamps, not stored:
 *   elapsed = now - started_at
 *   target  = duration_hours converted to seconds, but compressed for demo:
 *     ≤2h course → 10s real time
 *     2-8h       → 30s real time
 *     >8h        → 60s real time
 *   progress = min(100, (elapsed / target) * 100)
 *
 * When progress hits 100, we update the enrollment to 'completed'
 * and generate a certificate.
 */
export async function getEnrollmentStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { courseId } = req.params;

    const { data: enrollment, error } = await supabaseServiceRole
      .from('enrollments')
      .select('*, courses!inner(id, duration_hours, title)')
      .eq('user_id', req.user.id)
      .eq('course_id', courseId)
      .single();

    if (error || !enrollment) {
      res.json({ data: null, message: 'Not enrolled' });
      return;
    }

    // If already completed, just return
    if (enrollment.status === 'completed') {
      res.json({ data: { ...enrollment, progress_percent: 100 } });
      return;
    }

    // If not started, return as-is
    if (enrollment.status === 'not_started' || !enrollment.started_at) {
      res.json({ data: { ...enrollment, progress_percent: 0 } });
      return;
    }

    // Calculate dummy progress based on elapsed time
    const durationHours = (enrollment.courses as Record<string, unknown>)?.duration_hours as number || 4;
    const startedAt = new Date(enrollment.started_at).getTime();
    const now = Date.now();
    const elapsedMs = now - startedAt;

    // Compress real time for demo:
    // ≤2h course → 10s, 2-8h → 30s, >8h → 60s
    let targetSeconds: number;
    if (durationHours <= 2) targetSeconds = 10;
    else if (durationHours <= 8) targetSeconds = 30;
    else targetSeconds = 60;

    const targetMs = targetSeconds * 1000;
    const progressPercent = Math.min(100, Math.round((elapsedMs / targetMs) * 100));

    // If completed, update the enrollment
    if (progressPercent >= 100 && enrollment.status !== 'completed') {
      await supabaseServiceRole
        .from('enrollments')
        .update({
          status: 'completed',
          progress_percent: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', enrollment.id);

      // Generate certificate (if not already exists)
      const { data: existingCert } = await supabaseServiceRole
        .from('certificates')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('course_id', courseId)
        .single();

      if (!existingCert) {
        const crypto = await import('crypto');
        const verificationHash = crypto
          .createHash('sha256')
          .update(`${req.user.id}-${courseId}-${Date.now()}`)
          .digest('hex');

        await supabaseServiceRole.from('certificates').insert({
          user_id: req.user.id,
          course_id: courseId,
          verification_hash: verificationHash,
        });
      }

      res.json({
        data: {
          ...enrollment,
          status: 'completed',
          progress_percent: 100,
          completed_at: new Date().toISOString(),
        },
      });
      return;
    }

    // Update progress_percent in DB periodically (every 10%)
    const storedProgress = enrollment.progress_percent || 0;
    if (progressPercent - storedProgress >= 10) {
      await supabaseServiceRole
        .from('enrollments')
        .update({ progress_percent: progressPercent })
        .eq('id', enrollment.id);
    }

    res.json({
      data: { ...enrollment, progress_percent: progressPercent },
    });
  } catch {
    next(new AppError('Failed to get enrollment status', 500));
  }
}

// ─── GET MY ENROLLMENTS ──────────────────────────────────────────────────────
export async function getMyEnrollments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const { data, error } = await supabaseServiceRole
      .from('enrollments')
      .select(`
        *,
        courses ( id, title, description, source, duration_hours, external_url )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return next(new AppError('Failed to fetch enrollments', 500));
    }

    // Compute live progress for in-progress enrollments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (data || []).map((enroll: any) => {
      if (enroll.status === 'completed') {
        return { ...enroll, computed_progress: 100 };
      }
      if (enroll.status === 'not_started' || !enroll.started_at) {
        return { ...enroll, computed_progress: 0 };
      }

      const durationHours = (enroll.courses as Record<string, unknown> | null)?.duration_hours as number || 4;
      const startedAt = new Date(enroll.started_at).getTime();
      const elapsedMs = Date.now() - startedAt;

      let targetSeconds: number;
      if (durationHours <= 2) targetSeconds = 10;
      else if (durationHours <= 8) targetSeconds = 30;
      else targetSeconds = 60;

      const progressPercent = Math.min(100, Math.round((elapsedMs / (targetSeconds * 1000)) * 100));
      return { ...enroll, computed_progress: progressPercent };
    });

    res.json({ data: enriched });
  } catch {
    next(new AppError('Failed to fetch enrollments', 500));
  }
}
