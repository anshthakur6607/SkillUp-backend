/**
 * Dashboard controller — serves data for the dashboard pages.
 *
 * Uses the ANON client to respect RLS — each user can only see their own
 * enrollments, scores, and certificates. Courses are public (readable by all).
 */

import { Request, Response, NextFunction } from "express";
import { supabaseAnon } from "../config/supabaseClient";
import { AppError } from "../middleware/errorHandler";
import { cacheGetOrSet } from "../config/redis";

// =============================================================================
// GET /api/dashboard/stats
// =============================================================================
/**
 * Returns aggregated stats for the dashboard home page.
 * Cached for 2 minutes per user.
 */
export async function getDashboardStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const cacheKey = `dashboard-stats:${userId}`;

    const stats = await cacheGetOrSet(
      cacheKey,
      120,
      async () => {
        // Fetch enrollments
        const { data: enrollments } = await supabaseAnon
          .from("enrollments")
          .select("status, progress_percent, course_id")
          .eq("user_id", userId);

        // Fetch certificates
        const { data: certificates } = await supabaseAnon
          .from("certificates")
          .select("id")
          .eq("user_id", userId);

        // Fetch competency scores
        const { data: scores } = await supabaseAnon
          .from("user_competency_scores")
          .select("score")
          .eq("user_id", userId);

        // Calculate stats
        const coursesEnrolled = enrollments?.length || 0;
        const coursesCompleted =
          enrollments?.filter((e) => e.status === "completed").length || 0;
        const certificatesEarned = certificates?.length || 0;
        const competencyScore =
          scores && scores.length > 0
            ? Math.round(
                scores.reduce((sum, s) => sum + (s.score || 0), 0) /
                  scores.length
              )
            : 0;

        // Estimate hours learned (rough: completed courses * avg duration)
        const { data: completedCourses } = await supabaseAnon
          .from("enrollments")
          .select("course_id, courses!inner(duration_hours)")
          .eq("user_id", userId)
          .eq("status", "completed");

        let hoursLearned = 0;
        if (completedCourses) {
          hoursLearned = completedCourses.reduce(
            (sum, e: any) => sum + (e.courses?.duration_hours || 0),
            0
          );
        }

        return {
          coursesEnrolled,
          coursesCompleted,
          hoursLearned: Math.round(hoursLearned * 10) / 10,
          certificatesEarned,
          competencyScore,
        };
      },
    );

    res.json({ status: "ok", data: stats });
  } catch {
    next(new AppError("Failed to fetch dashboard stats", 500));
  }
}

// =============================================================================
// GET /api/dashboard/courses
// =============================================================================
/**
 * Returns all active courses available for enrollment.
 */
export async function getCourses(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const cacheKey = "courses:list";

    const courses = await cacheGetOrSet(
      cacheKey,
      300, // Cache for 5 minutes (courses don't change often)
      async () => {
        const { data, error } = await supabaseAnon
          .from("courses")
          .select("*")
          .eq("is_active", true)
          .order("title");

        if (error) return null;
        return data || [];
      },
    );

    res.json({ status: "ok", data: courses || [] });
  } catch {
    next(new AppError("Failed to fetch courses", 500));
  }
}

// =============================================================================
// GET /api/dashboard/enrollments
// =============================================================================
/**
 * Returns the user's enrolled courses with progress and course details.
 */
export async function getEnrollments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const cacheKey = `enrollments:${userId}`;

    const enrollments = await cacheGetOrSet(
      cacheKey,
      60, // Cache for 1 minute (progress changes frequently)
      async () => {
        const { data, error } = await supabaseAnon
          .from("enrollments")
          .select(
            `
            id,
            course_id,
            status,
            progress_percent,
            enrolled_at,
            started_at,
            completed_at,
            courses!inner(
              id,
              title,
              description,
              source,
              duration_hours
            )
          `
          )
          .eq("user_id", userId)
          .order("enrolled_at", { ascending: false });

        if (error) return null;

        // Flatten the nested course data
        return (data || []).map((e: any) => ({
          id: e.id,
          course_id: e.course_id,
          title: e.courses?.title || "Unknown Course",
          description: e.courses?.description || "",
          source: e.courses?.source || "",
          duration_hours: e.courses?.duration_hours || 0,
          status: e.status,
          progress_percent: e.progress_percent || 0,
          enrolled_at: e.enrolled_at,
          completed_at: e.completed_at,
        }));
      },
    );

    res.json({ status: "ok", data: enrollments || [] });
  } catch {
    next(new AppError("Failed to fetch enrollments", 500));
  }
}

// =============================================================================
// GET /api/dashboard/competencies
// =============================================================================
/**
 * Returns the user's competency scores grouped by domain.
 */
export async function getCompetencies(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const cacheKey = `competencies:${userId}`;

    const competencies = await cacheGetOrSet(
      cacheKey,
      120, // Cache for 2 minutes
      async () => {
        const { data, error } = await supabaseAnon
          .from("user_competency_scores")
          .select(
            `
            id,
            score,
            last_assessed_at,
            competencies!inner(
              id,
              name,
              description,
              competency_domains!inner(
                id,
                name
              )
            )
          `
          )
          .eq("user_id", userId)
          .order("score", { ascending: false });

        if (error) return null;

        return (data || []).map((s: any) => ({
          id: s.id,
          name: s.competencies?.name || "Unknown",
          domain: s.competencies?.competency_domains?.name || "General",
          score: s.score || 0,
          last_assessed_at: s.last_assessed_at,
        }));
      },
    );

    res.json({ status: "ok", data: competencies || [] });
  } catch {
    next(new AppError("Failed to fetch competencies", 500));
  }
}

// =============================================================================
// GET /api/dashboard/certificates
// =============================================================================
/**
 * Returns the user's earned certificates with course details.
 */
export async function getCertificates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const cacheKey = `certificates:${userId}`;

    const certificates = await cacheGetOrSet(
      cacheKey,
      300, // Cache for 5 minutes (certificates don't change)
      async () => {
        const { data, error } = await supabaseAnon
          .from("certificates")
          .select(
            `
            id,
            course_id,
            issued_at,
            verification_code,
            courses!inner(
              id,
              title
            )
          `
          )
          .eq("user_id", userId)
          .order("issued_at", { ascending: false });

        if (error) return null;

        return (data || []).map((c: any) => ({
          id: c.id,
          course_id: c.course_id,
          course_title: c.courses?.title || "Unknown Course",
          issued_at: c.issued_at,
          verification_code: c.verification_code,
        }));
      },
    );

    res.json({ status: "ok", data: certificates || [] });
  } catch {
    next(new AppError("Failed to fetch certificates", 500));
  }
}

// =============================================================================
// GET /api/dashboard/recommended
// =============================================================================
/**
 * Returns recommended courses for the user.
 * Strategy: courses the user hasn't enrolled in yet, ordered by most recent.
 * In the future, this could use competency gap analysis.
 */
export async function getRecommendedCourses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const cacheKey = `recommended:${userId}`;

    const courses = await cacheGetOrSet(
      cacheKey,
      300, // Cache for 5 minutes
      async () => {
        // Get course IDs the user is already enrolled in
        const { data: enrolled } = await supabaseAnon
          .from("enrollments")
          .select("course_id")
          .eq("user_id", userId);

        const enrolledIds = (enrolled || []).map((e) => e.course_id);

        // Fetch courses NOT in the enrolled list
        let query = supabaseAnon
          .from("courses")
          .select("*")
          .eq("is_active", true);

        if (enrolledIds.length > 0) {
          query = query.not("id", "in", `(${enrolledIds.join(",")})`);
        }

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) return null;
        return data || [];
      },
    );

    res.json({ status: "ok", data: courses || [] });
  } catch {
    next(new AppError("Failed to fetch recommended courses", 500));
  }
}
