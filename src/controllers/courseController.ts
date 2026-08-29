/**
 * Course Controller
 *
 * Fetches courses from iGOT's public content API in real-time.
 * Falls back to database if API is unavailable.
 * Includes dummy enrollment/progress monitoring for demo.
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseServiceRole } from '../config/supabaseClient';
import { AppError } from '../middleware/errorHandler';

// ─── iGOT COURSE IDs (real courses from the platform) ────────────────────────
const IGOT_COURSE_IDS = [
  'do_113923174474121216195',
  'do_1141533540853432321675',
  'do_1143166853070028801812',
  'do_1143052789530787841562',
  'do_113569878939262976132',
];

interface IGOTCourse {
  id: string;
  name: string;
  description: string;
  duration: string;
  difficultyLevel: string;
  instructions: string;
  childNodes: string[];
  leafNodes: string[];
  appIcon: string;
  posterImage: string;
  source: string;
  creator: string;
  organisation: string[];
  keywords: string[];
}

// Cache iGOT courses in memory (refresh every 5 minutes)
let cachedCourses: IGOTCourse[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchIGOTCourse(id: string): Promise<IGOTCourse | null> {
  try {
    const resp = await fetch(
      `https://igotkarmayogi.gov.in/api/content/v1/read/${id}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();
    const c = data?.result?.content;
    if (!c) return null;

    return {
      id: c.identifier || id,
      name: c.name || 'Untitled Course',
      description: stripHtml(c.description || ''),
      duration: c.duration || '0',
      difficultyLevel: c.difficultyLevel || 'Beginner',
      instructions: stripHtml(c.instructions || ''),
      childNodes: c.childNodes || [],
      leafNodes: c.leafNodes || [],
      appIcon: c.appIcon || '',
      posterImage: c.posterImage || '',
      source: 'igot',
      creator: c.creator || '',
      organisation: c.organisation || [],
      keywords: c.keywords || [],
    };
  } catch {
    return null;
  }
}

async function fetchIGOTCourses(): Promise<IGOTCourse[]> {
  const now = Date.now();
  if (cachedCourses && now - cacheTimestamp < CACHE_TTL) {
    return cachedCourses;
  }

  const results = await Promise.allSettled(
    IGOT_COURSE_IDS.map((id) => fetchIGOTCourse(id))
  );

  const courses = results
    .filter((r): r is PromiseFulfilledResult<IGOTCourse> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  if (courses.length > 0) {
    cachedCourses = courses;
    cacheTimestamp = now;
  }

  return courses;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── GET ALL ACTIVE COURSES ──────────────────────────────────────────────────
export async function getAllCourses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { source, search } = req.query;

    // Fetch from iGOT API
    let courses = await fetchIGOTCourses();

    // Also try database
    const { data: dbCourses } = await supabaseServiceRole
      .from('courses')
      .select('*')
      .eq('is_active', true)
      .order('title');

    if (dbCourses && dbCourses.length > 0) {
      // Merge: add DB courses that aren't already from iGOT API
      const igotIds = new Set(courses.map((c) => c.id));
      for (const dc of dbCourses) {
        if (!igotIds.has(dc.external_id || dc.id)) {
          courses.push({
            id: dc.id,
            name: dc.title,
            description: dc.description || '',
            duration: String((dc.duration_hours || 0) * 3600),
            difficultyLevel: 'Beginner',
            instructions: '',
            childNodes: [],
            leafNodes: [],
            appIcon: '',
            posterImage: '',
            source: dc.source || 'internal',
            creator: '',
            organisation: [],
            keywords: [],
          });
        }
      }
    }

    // Apply filters
    if (source && typeof source === 'string') {
      courses = courses.filter((c) => c.source === source);
    }
    if (search && typeof search === 'string') {
      const q = (search as string).toLowerCase();
      courses = courses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    // Transform for frontend
    const result = courses.map((c) => ({
      id: c.id,
      title: c.name,
      description: c.description,
      source: c.source,
      duration_hours: Math.round((parseInt(c.duration) / 3600) * 10) / 10 || 0.5,
      external_url: `https://portal.igotkarmayogi.gov.in/public/toc/${c.id}/overview`,
      is_active: true,
      difficulty: c.difficultyLevel,
      creator: c.creator,
      organisation: c.organisation?.[0] || '',
      keywords: c.keywords?.slice(0, 8) || [],
      module_count: c.childNodes?.length || 0,
    }));

    res.json({
      data: result,
      pagination: {
        page: 1,
        limit: result.length,
        total: result.length,
        totalPages: 1,
      },
    });
  } catch {
    next(new AppError('Failed to fetch courses', 500));
  }
}

// ─── GET SINGLE COURSE (with modules from iGOT API) ─────────────────────────
export async function getCourseById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    // Fetch from iGOT API
    const igotCourse = await fetchIGOTCourse(id);

    if (igotCourse) {
      // Fetch module names for child nodes
      const modules = await fetchIGOTModules(igotCourse.childNodes);

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

      res.json({
        data: {
          id: igotCourse.id,
          title: igotCourse.name,
          description: igotCourse.description,
          source: igotCourse.source,
          duration_hours: Math.round((parseInt(igotCourse.duration) / 3600) * 10) / 10 || 0.5,
          external_url: `https://portal.igotkarmayogi.gov.in/public/toc/${igotCourse.id}/overview`,
          is_active: true,
          difficulty: igotCourse.difficultyLevel,
          creator: igotCourse.creator,
          organisation: igotCourse.organisation?.[0] || '',
          keywords: igotCourse.keywords || [],
          instructions: igotCourse.instructions,
          modules,
          module_count: modules.length,
          poster_image: igotCourse.posterImage,
          app_icon: igotCourse.appIcon,
        },
        enrollment,
      });
      return;
    }

    // Fallback: try database
    const { data, error } = await supabaseServiceRole
      .from('courses')
      .select('*, course_competencies(competencies(id, name, description))')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return next(new AppError('Course not found', 404));
    }

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

// ─── FETCH MODULE NAMES FROM iGOT ────────────────────────────────────────────
async function fetchIGOTModules(
  childNodeIds: string[]
): Promise<Array<{ id: string; name: string; type: string; index: number }>> {
  if (!childNodeIds || childNodeIds.length === 0) return [];

  // Fetch in batches of 5 to avoid overwhelming the API
  const modules: Array<{ id: string; name: string; type: string; index: number }> = [];
  const batchSize = 5;

  for (let i = 0; i < childNodeIds.length; i += batchSize) {
    const batch = childNodeIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (nodeId) => {
        try {
        const resp = await fetch(
          `https://igotkarmayogi.gov.in/api/content/v1/read/${nodeId}`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (!resp.ok) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await resp.json();
        const c = data?.result?.content;
          if (!c) return null;
          return {
            id: c.identifier || nodeId,
            name: c.name || 'Untitled',
            type: c.mimeType?.includes('video')
              ? 'video'
              : c.mimeType?.includes('quiz') || c.mimeType?.includes('question')
              ? 'assessment'
              : c.primaryCategory === 'CourseUnit'
              ? 'module'
              : 'resource',
            index: i + batch.indexOf(nodeId),
          };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        modules.push(r.value);
      }
    }
  }

  return modules.sort((a, b) => a.index - b.index);
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

    // The courseId might be an iGOT string ID (e.g. "do_11392...") or a UUID.
    // We need a UUID to reference in the enrollments table.
    let dbCourseId = courseId;

    // Check if courseId is already a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(courseId)) {
      // It's an iGOT external ID — look up or create the course row
      const { data: existingCourse } = await supabaseServiceRole
        .from('courses')
        .select('id')
        .eq('external_id', courseId)
        .single();

      if (existingCourse) {
        dbCourseId = existingCourse.id;
      } else {
        // Create the course row from iGOT data
        const igotCourse = await fetchIGOTCourse(courseId);
        const { data: newCourse, error: insertErr } = await supabaseServiceRole
          .from('courses')
          .insert({
            title: igotCourse?.name || courseId,
            description: igotCourse?.description || '',
            source: 'igot',
            external_id: courseId,
            external_url: `https://portal.igotkarmayogi.gov.in/public/toc/${courseId}/overview`,
            duration_hours: igotCourse ? Math.round((parseInt(igotCourse.duration) / 3600) * 10) / 10 || 0.5 : 0.5,
            is_active: true,
          })
          .select('id')
          .single();

        if (insertErr || !newCourse) {
          return next(new AppError('Failed to create course record', 500));
        }
        dbCourseId = newCourse.id;
      }
    }

    // Check if already enrolled
    const { data: existing } = await supabaseServiceRole
      .from('enrollments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', dbCourseId)
      .single();

    if (existing) {
      res.json({ data: existing, message: 'Already enrolled' });
      return;
    }

    // Create enrollment
    const { data, error } = await supabaseServiceRole
      .from('enrollments')
      .insert({
        user_id: userId,
        course_id: dbCourseId,
        status: 'not_started',
        progress_percent: 0,
      })
      .select()
      .single();

    if (error) {
      return next(new AppError('Failed to enroll: ' + (error.message || 'unknown'), 500));
    }

    res.status(201).json({ data, message: 'Enrolled successfully' });
  } catch {
    next(new AppError('Failed to enroll', 500));
  }
}

// ─── HELPER: resolve iGOT ID to DB UUID ─────────────────────────────────────
async function resolveCourseId(courseId: string): Promise<string> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(courseId)) return courseId;

  const { data } = await supabaseServiceRole
    .from('courses')
    .select('id')
    .eq('external_id', courseId)
    .single();

  return data?.id || courseId;
}

// ─── START COURSE (Dummy Monitoring) ─────────────────────────────────────────
export async function startCourse(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const courseId = await resolveCourseId(req.params.courseId);
    const userId = req.user.id;

    const { data: enrollment, error: enrollErr } = await supabaseServiceRole
      .from('enrollments')
      .select('*, courses!inner(id, duration_hours, title)')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (enrollErr || !enrollment) {
      return next(new AppError('Not enrolled. Enroll first.', 400));
    }

    if (enrollment.status === 'completed') {
      res.json({ data: enrollment, message: 'Already completed' });
      return;
    }

    if (enrollment.status === 'not_started' || !enrollment.started_at) {
      await supabaseServiceRole
        .from('enrollments')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', enrollment.id);
    }

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

// ─── GET ENROLLMENT STATUS ───────────────────────────────────────────────────
export async function getEnrollmentStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const courseId = await resolveCourseId(req.params.courseId);

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

    if (enrollment.status === 'completed') {
      res.json({ data: { ...enrollment, progress_percent: 100 } });
      return;
    }

    if (enrollment.status === 'not_started' || !enrollment.started_at) {
      res.json({ data: { ...enrollment, progress_percent: 0 } });
      return;
    }

    // Calculate dummy progress
    const durationHours = (enrollment.courses as Record<string, unknown>)?.duration_hours as number || 4;
    const startedAt = new Date(enrollment.started_at).getTime();
    const elapsedMs = Date.now() - startedAt;

    let targetSeconds: number;
    if (durationHours <= 0.5) targetSeconds = 10;
    else if (durationHours <= 2) targetSeconds = 20;
    else if (durationHours <= 8) targetSeconds = 30;
    else targetSeconds = 60;

    const progressPercent = Math.min(100, Math.round((elapsedMs / (targetSeconds * 1000)) * 100));

    if (progressPercent >= 100 && enrollment.status !== 'completed') {
      await supabaseServiceRole
        .from('enrollments')
        .update({ status: 'completed', progress_percent: 100, completed_at: new Date().toISOString() })
        .eq('id', enrollment.id);

      // Generate certificate
      const { data: existingCert } = await supabaseServiceRole
        .from('certificates')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('course_id', courseId)
        .single();

      if (!existingCert) {
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(`${req.user.id}-${courseId}-${Date.now()}`).digest('hex');
        await supabaseServiceRole.from('certificates').insert({
          user_id: req.user.id,
          course_id: courseId,
          verification_hash: hash,
        });
      }

      res.json({
        data: { ...enrollment, status: 'completed', progress_percent: 100, completed_at: new Date().toISOString() },
      });
      return;
    }

    res.json({ data: { ...enrollment, progress_percent: progressPercent } });
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
      .select('*, courses(id, title, description, source, duration_hours, external_url)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return next(new AppError('Failed to fetch enrollments', 500));
    }

    res.json({ data: data || [] });
  } catch {
    next(new AppError('Failed to fetch enrollments', 500));
  }
}
