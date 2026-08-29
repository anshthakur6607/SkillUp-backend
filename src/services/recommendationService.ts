/**
 * Hybrid Recommendation Engine — combines three signals for course recommendations:
 *
 * 1. CONTENT-BASED: Match user's competency gaps to courses that teach those competencies
 * 2. COLLABORATIVE: What officials in similar roles/departments completed successfully
 * 3. RULE-BASED: Mandatory/compliance courses always outrank others
 *
 * The final ranking merges all three signals with configurable weights.
 */

import { supabaseServiceRole } from '../config/supabaseClient';
import { getUserGraphPaths } from './knowledgeGraphService';

export interface Recommendation {
  courseId: string;
  courseTitle: string;
  courseDescription: string;
  source: string;
  externalUrl: string;
  score: number;
  signal: 'content' | 'collaborative' | 'rule' | 'combined';
  explanation: string;
  competencies: string[];
}

// Mandatory courses that every government official must take
const MANDATORY_KEYWORDS = [
  'sexual harassment',
  'posh',
  'prevention',
  'data privacy',
  'dpdp',
  'cyber security',
  'cybersecurity',
  'rti',
  'right to information',
  'swachata',
  'cleanliness',
  'fire safety',
];

/**
 * Get personalized course recommendations for a user.
 */
export async function getRecommendations(userId: string, limit: number = 10): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // Get user profile
  const { data: profile } = await supabaseServiceRole
    .from('profiles')
    .select('id, designation, department_id, job_role, education_level')
    .eq('id', userId)
    .single();

  if (!profile) return recommendations;

  // Get all available courses
  // Fetch from iGOT API directly (same as course controller)
  const courses = await fetchAvailableCourses();

  // Get user's existing enrollments to exclude already-enrolled
  const { data: enrollments } = await supabaseServiceRole
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId);

  const enrolledIds = new Set((enrollments || []).map((e) => e.course_id));

  // Get user's competency scores
  const { data: scores } = await supabaseServiceRole
    .from('user_competency_scores')
    .select('competency_id, score, competencies(name)')
    .eq('user_id', userId);

  const weakCompetencies = new Set(
    (scores || [])
      .filter((s) => (s.score || 0) < 60)
      .map((s) => {
        // competencies is an array from Supabase join
        const comps = s.competencies as unknown[];
        const first = Array.isArray(comps) ? comps[0] as Record<string, string> : comps as Record<string, string>;
        return first?.name?.toLowerCase();
      })
      .filter(Boolean)
  );

  // Signal 1: Content-based — match weak competencies to courses
  for (const course of courses) {
    if (enrolledIds.has(course.id)) continue;

    const titleLower = course.title.toLowerCase();
    const descLower = (course.description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    let contentScore = 0;
    let matchedComps: string[] = [];

    for (const comp of weakCompetencies) {
      if (comp && combined.includes(comp.toLowerCase())) {
        contentScore += 0.3;
        matchedComps.push(comp);
      }
    }

    // Boost if course description mentions competencies
    if (matchedComps.length > 0) {
      recommendations.push({
        courseId: course.id,
        courseTitle: course.title,
        courseDescription: course.description || '',
        source: course.source || 'igot',
        externalUrl: course.external_url || '',
        score: Math.min(1, contentScore),
        signal: 'content',
        explanation: matchedComps.length === 1
          ? `Addresses your gap in "${matchedComps[0]}"`
          : `Addresses gaps in: ${matchedComps.join(', ')}`,
        competencies: matchedComps,
      });
    }
  }

  // Signal 2: Collaborative — what similar officials completed
  if (profile.designation || profile.department_id) {
    const { data: similarUsers } = await supabaseServiceRole
      .from('profiles')
      .select('id')
      .or(`designation.eq.${profile.designation || ''},department_id.eq.${profile.department_id || ''}`)
      .neq('id', userId)
      .limit(20);

    if (similarUsers && similarUsers.length > 0) {
      const similarIds = similarUsers.map((u) => u.id);

      // Find courses completed by similar users
      const { data: collabEnrollments } = await supabaseServiceRole
        .from('enrollments')
        .select('course_id, courses(title, description, source, external_url)')
        .in('user_id', similarIds)
        .eq('status', 'completed')
        .limit(50);

      // Count completions per course
      const completionCounts = new Map<string, { count: number; course: Record<string, unknown> }>();
      for (const e of (collabEnrollments || [])) {
        // courses is an array from Supabase join
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const courseArr = e.courses as any[];
        const courseObj = Array.isArray(courseArr) ? courseArr[0] : courseArr;
        const existing = completionCounts.get(e.course_id) || { count: 0, course: courseObj as Record<string, unknown> };
        existing.count++;
        completionCounts.set(e.course_id, existing);
      }

      // Add collaborative recommendations
      for (const [courseId, data] of completionCounts) {
        if (enrolledIds.has(courseId)) continue;
        const course = data.course;
        if (!course) continue;

        const collabScore = Math.min(1, data.count / Math.max(similarUsers.length, 1));

        // Only add if not already recommended by content-based
        const existing = recommendations.find((r) => r.courseId === courseId);
        if (existing) {
          existing.score = Math.max(existing.score, collabScore * 0.8);
          existing.signal = 'combined';
          existing.explanation += ` | Also popular among ${data.count} officials with similar roles`;
        } else if (collabScore > 0.1) {
          recommendations.push({
            courseId,
            courseTitle: course.title as string,
            courseDescription: (course.description as string) || '',
            source: (course.source as string) || 'igot',
            externalUrl: (course.external_url as string) || '',
            score: collabScore * 0.8,
            signal: 'collaborative',
            explanation: `Completed by ${data.count} officials with similar roles`,
            competencies: [],
          });
        }
      }
    }
  }

  // Signal 3: Rule-based — mandatory courses always rank first
  for (const course of courses) {
    if (enrolledIds.has(course.id)) continue;

    const titleLower = course.title.toLowerCase();
    const descLower = (course.description || '').toLowerCase();
    const combined = `${titleLower} ${descLower}`;

    const isMandatory = MANDATORY_KEYWORDS.some((kw) => combined.includes(kw));
    if (isMandatory) {
      const existing = recommendations.find((r) => r.courseId === course.id);
      if (existing) {
        existing.score = 1.0; // Mandatory always max
        existing.signal = 'rule';
        existing.explanation = 'MANDATORY: Required for all government officials';
      } else {
        recommendations.push({
          courseId: course.id,
          courseTitle: course.title,
          courseDescription: course.description || '',
          source: course.source || 'igot',
          externalUrl: course.external_url || '',
          score: 1.0,
          signal: 'rule',
          explanation: 'MANDATORY: Required for all government officials',
          competencies: [],
        });
      }
    }
  }

  // Sort by score descending, return top N
  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, limit);
}

/**
 * Fetch available courses from iGOT API (same IDs as course controller).
 */
async function fetchAvailableCourses(): Promise<Array<{ id: string; title: string; description: string; source: string; external_url: string }>> {
  const IGOT_IDS = [
    'do_113923174474121216195',
    'do_1141533540853432321675',
    'do_1143166853070028801812',
    'do_1143052789530787841562',
    'do_113569878939262976132',
  ];

  const courses: Array<{ id: string; title: string; description: string; source: string; external_url: string }> = [];

  const results = await Promise.allSettled(
    IGOT_IDS.map(async (id) => {
      try {
        const resp = await fetch(`https://igotkarmayogi.gov.in/api/content/v1/read/${id}`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return null;
        const data = await resp.json() as Record<string, unknown>;
        const c = (data?.result as Record<string, unknown>)?.content as Record<string, unknown>;
        if (!c) return null;
        return {
          id: (c.identifier as string) || id,
          title: (c.name as string) || 'Untitled',
          description: ((c.description as string) || '').replace(/<[^>]*>/g, '').substring(0, 500),
          source: 'igot',
          external_url: `https://portal.igotkarmayogi.gov.in/public/toc/${c.identifier || id}/overview`,
        };
      } catch {
        return null;
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) courses.push(r.value);
  }

  return courses;
}
