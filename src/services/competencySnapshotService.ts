/**
 * Competency Snapshot Service — generates initial competency scores
 * from profile data after onboarding, so the dashboard isn't empty.
 *
 * Uses designation + education + job_role to estimate baseline competency levels.
 * This is a "placement test" without requiring the user to take an actual test.
 *
 * Algorithm:
 * - Each designation has baseline competency expectations
 * - Education level adjusts scores up/down
 * - Job role provides additional specialization signals
 * - Scores are Conservative (lower is better) — real assessments will calibrate
 */

import { supabaseServiceRole } from '../config/supabaseClient';

interface SnapshotResult {
  competenciesScored: number;
  scores: Array<{ name: string; domain: string; score: number }>;
}

// Baseline competency scores by designation tier
const DESIGNATION_BASELINES: Record<string, Record<string, number>> = {
  // Entry level
  'Assistant': { 'Communication': 50, 'Data Analysis & Interpretation': 30, 'Python Programming': 20, 'Critical Thinking': 40 },
  'Section Officer': { 'Communication': 55, 'Data Analysis & Interpretation': 35, 'Project Management': 45, 'Leadership': 35 },
  'Statistical Officer': { 'Survey Design': 50, 'Sampling Techniques': 45, 'Statistical Inference': 40, 'Data Analysis & Interpretation': 50 },
  // Mid level
  'Deputy Director': { 'Leadership': 50, 'Project Management': 55, 'Communication': 60, 'Critical Thinking': 55, 'Data Analysis & Interpretation': 45 },
  'Assistant Director': { 'Communication': 55, 'Data Analysis & Interpretation': 40, 'Python Programming': 30, 'Critical Thinking': 50 },
  // Senior level
  'Joint Secretary': { 'Leadership': 65, 'Communication': 70, 'Project Management': 60, 'Critical Thinking': 65, 'Strategic Planning': 50 },
  'Additional Secretary': { 'Leadership': 70, 'Communication': 75, 'Strategic Planning': 55, 'Critical Thinking': 70 },
  'Secretary': { 'Leadership': 80, 'Strategic Planning': 65, 'Communication': 80, 'Critical Thinking': 75 },
};

// Education level adjustments
const EDUCATION_ADJUSTMENTS: Record<string, number> = {
  'high_school': -5,
  'diploma': -3,
  'bachelors': 0,
  'bachelors_engineering': 2,
  'masters': 5,
  'masters_engineering': 7,
  'phd': 10,
  'professional': 5,
  'other': 0,
};

// Default competency scores for unmatched designations
const DEFAULT_SCORES: Record<string, number> = {
  'Communication': 45,
  'Critical Thinking': 40,
  'Data Analysis & Interpretation': 35,
  'Project Management': 35,
  'Leadership': 30,
};

/**
 * Generate initial competency snapshot from profile data.
 * Called after onboarding completes.
 */
export async function generateCompetencySnapshot(userId: string): Promise<SnapshotResult> {
  // Get profile
  const { data: profile } = await supabaseServiceRole
    .from('profiles')
    .select('designation, education_level, job_role, government_level')
    .eq('id', userId)
    .single();

  if (!profile) return { competenciesScored: 0, scores: [] };

  // Check if user already has competency scores
  const { data: existing } = await supabaseServiceRole
    .from('user_competency_scores')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { competenciesScored: 0, scores: [] }; // Already has scores
  }

  const designation = profile.designation || '';
  const education = profile.education_level || '';

  // Get baseline scores for this designation
  let baselines = DESIGNATION_BASELINES[designation];
  if (!baselines) {
    // Try partial match
    for (const [key, val] of Object.entries(DESIGNATION_BASELINES)) {
      if (designation.toLowerCase().includes(key.toLowerCase())) {
        baselines = val;
        break;
      }
    }
  }
  if (!baselines) baselines = DEFAULT_SCORES;

  // Apply education adjustment
  const eduAdj = EDUCATION_ADJUSTMENTS[education] || 0;

  // Get all competencies from the database
  const { data: allComps } = await supabaseServiceRole
    .from('competencies')
    .select('id, name, competency_domains(name)');

  const results: Array<{ name: string; domain: string; score: number }> = [];

  for (const comp of (allComps || [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domainArr = (comp as any).competency_domains;
    const domainName = Array.isArray(domainArr) ? domainArr[0]?.name : domainArr?.name || 'General';
    const score = baselines[comp.name] || 30; // Default 30 for unmatched competencies
    const adjustedScore = Math.max(10, Math.min(90, score + eduAdj));

    // Insert the score
    await supabaseServiceRole.from('user_competency_scores').insert({
      user_id: userId,
      competency_id: comp.id,
      score: adjustedScore,
      last_assessed_at: new Date().toISOString(),
    });

    results.push({ name: comp.name, domain: domainName, score: adjustedScore });
  }

  return { competenciesScored: results.length, scores: results };
}
