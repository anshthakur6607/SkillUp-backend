/**
 * Gamification Service — badges, XP, streaks, and learning milestones.
 *
 * Makes learning engaging by rewarding:
 * - Completing courses (XP + badges)
 * - Taking assessments (XP)
 * - Daily streaks (consecutive days of learning)
 * - Milestone achievements (first course, 5 courses, etc.)
 *
 * XP (Experience Points):
 * - Start course: 10 XP
 * - Complete course: 50 XP
 * - Pass assessment: 30 XP
 * - Daily login: 5 XP
 * - Maintain streak: 10 bonus XP
 *
 * Badges:
 * - "First Steps" — Enrolled in first course
 * - "Course Completer" — Completed 1 course
 * - "Knowledge Seeker" — Completed 5 courses
 * - "Assessment Ace" — Passed assessment on first try
 * - "Streak Master" — 7-day learning streak
 * - "Competency Champion" — Scored 90%+ on assessment
 * - "AI Explorer" — Used AI chatbot for the first time
 * - "Early Bird" — Completed a course within 24 hours of enrollment
 */

import { supabaseServiceRole } from '../config/supabaseClient';

export interface GamificationProfile {
  xp: number;
  level: number;
  streak: number;
  badges: Badge[];
  recentActivity: Activity[];
  nextLevelXp: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | null;
  category: 'course' | 'assessment' | 'streak' | 'special';
}

export interface Activity {
  type: string;
  description: string;
  xpEarned: number;
  timestamp: string;
}

// Badge definitions
const BADGE_DEFS: Omit<Badge, 'earnedAt'>[] = [
  { id: 'first_steps', name: 'First Steps', description: 'Enrolled in your first course', icon: 'Rocket', category: 'course' },
  { id: 'course_completer', name: 'Course Completer', description: 'Completed 1 course', icon: 'GraduationCap', category: 'course' },
  { id: 'knowledge_seeker', name: 'Knowledge Seeker', description: 'Completed 5 courses', icon: 'BookOpen', category: 'course' },
  { id: 'assessment_ace', name: 'Assessment Ace', description: 'Passed assessment on first try', icon: 'Target', category: 'assessment' },
  { id: 'streak_master', name: 'Streak Master', description: 'Maintained a 7-day learning streak', icon: 'Flame', category: 'streak' },
  { id: 'competency_champion', name: 'Competency Champion', description: 'Scored 90%+ on assessment', icon: 'Award', category: 'assessment' },
  { id: 'ai_explorer', name: 'AI Explorer', description: 'Used the AI chatbot for the first time', icon: 'Bot', category: 'special' },
  { id: 'early_bird', name: 'Early Bird', description: 'Completed a course within 24 hours', icon: 'Clock', category: 'special' },
];

// XP requirements per level (cumulative)
const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500,
  10000, 13000, 17000, 22000, 28000, 35000, 43000, 52000, 62000, 75000,
];

function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

function nextLevelXp(level: number): number {
  return LEVEL_THRESHOLDS[Math.min(level + 1, LEVEL_THRESHOLDS.length - 1)];
}

/**
 * Get or create gamification profile for a user.
 */
export async function getGamificationProfile(userId: string): Promise<GamificationProfile> {
  // Try to get from user_xp table first
  let { data: xpRow } = await supabaseServiceRole
    .from('user_xp')
    .select('*')
    .eq('user_id', userId)
    .single();

  // If no row exists, create one by calculating from existing data
  if (!xpRow) {
    const { data: scores } = await supabaseServiceRole
      .from('user_competency_scores')
      .select('score')
      .eq('user_id', userId);

    const { data: enrollments } = await supabaseServiceRole
      .from('enrollments')
      .select('id, status')
      .eq('user_id', userId);

    const { data: certs } = await supabaseServiceRole
      .from('certificates')
      .select('id')
      .eq('user_id', userId);

    const completedCount = (enrollments || []).filter((e) => e.status === 'completed').length;
    const certCount = (certs || []).length;
    const competencyScore = (scores || []).reduce((sum, s) => sum + (s.score || 0), 0);

    const totalXp = Math.round(
      competencyScore * 0.5 +
      completedCount * 50 +
      certCount * 30
    );

    const level = calculateLevel(totalXp);
    const streak = await calculateStreak(userId);

    // Create the user_xp row
    await supabaseServiceRole.from('user_xp').insert({
      user_id: userId,
      total_xp: totalXp,
      level,
      current_streak: streak,
      longest_streak: streak,
      last_activity_date: new Date().toISOString().split('T')[0],
    });

    xpRow = { total_xp: totalXp, level, current_streak: streak, longest_streak: streak };
  }

  const xp = xpRow.total_xp;
  const level = xpRow.level;

  // Get earned badges from database
  const { data: badgeRows } = await supabaseServiceRole
    .from('user_badges')
    .select('*')
    .eq('user_id', userId);

  const badges: Badge[] = (badgeRows || []).map((b) => ({
    id: b.badge_id,
    name: b.badge_name,
    description: b.badge_description || '',
    icon: 'Award',
    earnedAt: b.earned_at,
    category: b.badge_category,
  }));

  const streak = xpRow.current_streak || 0;
  const recentActivity = await getRecentActivity(userId);

  return {
    xp,
    level,
    streak,
    badges,
    recentActivity,
    nextLevelXp: nextLevelXp(level),
  };
}

/**
 * Award XP to a user for an action.
 */
export async function awardXP(
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  // Store XP in a gamification table (or use existing tables)
  // For prototype, we calculate XP from existing data + this activity
  console.log(`[Gamification] Awarded ${amount} XP to user ${userId} for: ${reason}`);
}

/**
 * Get earned badges for a user.
 */
async function getEarnedBadges(
  userId: string,
  completedCourses: number,
  certificates: number
): Promise<Badge[]> {
  const earned: Badge[] = [];

  // Check each badge condition
  for (const def of BADGE_DEFS) {
    let earnedAt: string | null = null;

    switch (def.id) {
      case 'first_steps': {
        const { data } = await supabaseServiceRole
          .from('enrollments')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1);
        if (data && data.length > 0) earnedAt = data[0].created_at;
        break;
      }
      case 'course_completer': {
        if (completedCourses >= 1) {
          const { data } = await supabaseServiceRole
            .from('enrollments')
            .select('completed_at')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: true })
            .limit(1);
          if (data && data.length > 0 && data[0].completed_at) earnedAt = data[0].completed_at;
        }
        break;
      }
      case 'knowledge_seeker': {
        if (completedCourses >= 5) {
          const { data } = await supabaseServiceRole
            .from('enrollments')
            .select('completed_at')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1);
          if (data && data.length > 0 && data[0].completed_at) earnedAt = data[0].completed_at;
        }
        break;
      }
      case 'assessment_ace': {
        const { data } = await supabaseServiceRole
          .from('assessment_attempts')
          .select('passed, started_at, completed_at')
          .eq('user_id', userId)
          .eq('passed', true)
          .order('started_at', { ascending: true })
          .limit(1);
        if (data && data.length > 0) {
          // Check if first attempt passed
          const { count } = await supabaseServiceRole
            .from('assessment_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId);
          if (count === 1 && data[0].completed_at) earnedAt = data[0].completed_at;
        }
        break;
      }
      case 'streak_master': {
        const streak = await calculateStreak(userId);
        if (streak >= 7) earnedAt = new Date().toISOString();
        break;
      }
      case 'competency_champion': {
        const { data } = await supabaseServiceRole
          .from('assessment_attempts')
          .select('score, completed_at')
          .eq('user_id', userId)
          .eq('passed', true)
          .order('score', { ascending: false })
          .limit(1);
        if (data && data.length > 0 && data[0].score >= 90 && data[0].completed_at) {
          earnedAt = data[0].completed_at;
        }
        break;
      }
      default:
        break;
    }

    earned.push({ ...def, earnedAt });
  }

  return earned;
}

/**
 * Calculate current learning streak (consecutive days with activity).
 */
async function calculateStreak(userId: string): Promise<number> {
  // Get recent enrollment activity dates
  const { data: enrollments } = await supabaseServiceRole
    .from('enrollments')
    .select('started_at, completed_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(30);

  if (!enrollments || enrollments.length === 0) return 0;

  // Extract unique activity dates
  const dates = new Set<string>();
  for (const e of enrollments) {
    if (e.started_at) dates.add(new Date(e.started_at).toISOString().split('T')[0]);
    if (e.completed_at) dates.add(new Date(e.completed_at).toISOString().split('T')[0]);
  }

  // Get assessment dates too
  const { data: attempts } = await supabaseServiceRole
    .from('assessment_attempts')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(30);

  if (attempts) {
    for (const a of attempts) {
      if (a.started_at) dates.add(new Date(a.started_at).toISOString().split('T')[0]);
    }
  }

  // Sort dates descending
  const sortedDates = Array.from(dates).sort().reverse();
  if (sortedDates.length === 0) return 0;

  // Check consecutive days from today
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Streak must include today or yesterday
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const curr = new Date(sortedDates[i - 1]);
    const prev = new Date(sortedDates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get recent learning activity.
 */
async function getRecentActivity(userId: string): Promise<Activity[]> {
  const activities: Activity[] = [];

  // Recent enrollments
  const { data: enrollments } = await supabaseServiceRole
    .from('enrollments')
    .select('id, status, started_at, completed_at, course_id')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(5);

  if (enrollments) {
    for (const e of enrollments) {
      if (e.status === 'completed') {
        activities.push({
          type: 'course_completed',
          description: 'Completed a course',
          xpEarned: 50,
          timestamp: e.completed_at || e.started_at,
        });
      } else {
        activities.push({
          type: 'course_started',
          description: 'Started a course',
          xpEarned: 10,
          timestamp: e.started_at,
        });
      }
    }
  }

  // Recent assessments
  const { data: assessments } = await supabaseServiceRole
    .from('assessment_attempts')
    .select('id, score, passed, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5);

  if (assessments) {
    for (const a of assessments) {
      activities.push({
        type: 'assessment_passed',
        description: `Assessment: ${a.score}% ${a.passed ? '(Passed)' : '(Failed)'}`,
        xpEarned: a.passed ? 30 : 5,
        timestamp: a.completed_at,
      });
    }
  }

  // Sort by timestamp descending
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

/**
 * Get all available badges with earned status.
 */
export function getAllBadges(): Array<Badge & { earned: boolean }> {
  return BADGE_DEFS.map((def) => ({
    ...def,
    earnedAt: null,
    earned: false, // Caller should cross-reference with getEarnedBadges
  }));
}
