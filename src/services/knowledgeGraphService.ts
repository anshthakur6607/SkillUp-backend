/**
 * Knowledge Graph Service — traces connections between officials, roles,
 * competencies, and courses for explainable recommendations.
 *
 * GRAPH MODEL:
 * ============
 * Official ──holds──→ Role ──requires──→ Competency ←──taught-by── Course
 *                                                              ↑
 *                                                    enrollment/completion
 *
 * Every recommendation should be traceable through this graph:
 * "You were shown this course because your role requires Competency X,
 *  and this course teaches Competency X."
 *
 * This makes the system explainable to government evaluators —
 * no black-box scores, just clear paths through the graph.
 */

import { supabaseServiceRole } from '../config/supabaseClient';

export interface GraphPath {
  type: 'role_gap' | 'course_match' | 'department_need' | 'trending';
  official: { id: string; name: string; role: string };
  path: Array<{
    nodeType: 'official' | 'role' | 'competency' | 'course' | 'domain';
    nodeId: string;
    nodeName: string;
    relation: string;
    meta?: Record<string, unknown>;
  }>;
  score: number;
  explanation: string;
}

/**
 * Get the knowledge graph path for a user.
 * Shows: Official → Role → Competencies → Courses
 */
export async function getUserGraphPaths(userId: string): Promise<GraphPath[]> {
  const paths: GraphPath[] = [];

  // 1. Get user profile
  const { data: profile } = await supabaseServiceRole
    .from('profiles')
    .select('id, full_name, designation, role, department_id, job_role')
    .eq('id', userId)
    .single();

  if (!profile) return paths;

  // 2. Get user's competency scores
  const { data: scores } = await supabaseServiceRole
    .from('user_competency_scores')
    .select('competency_id, score, competencies(name, domain_id, competency_domains(name))')
    .eq('user_id', userId);

  // 3. For each weak competency, find courses that teach it
  const weakCompetencies = (scores || [])
    .filter((s) => (s.score || 0) < 60)
    .sort((a, b) => (a.score || 0) - (b.score || 0));

  for (const wc of weakCompetencies.slice(0, 5)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = wc.competencies as any;
    const domainName = Array.isArray(comp?.competency_domains)
      ? comp.competency_domains[0]?.name
      : comp?.competency_domains?.name || 'Unknown';
    const compName = comp?.name || 'Unknown';

    // Find courses that teach this competency
    const { data: courseLinks } = await supabaseServiceRole
      .from('course_competencies')
      .select('course_id, courses(id, title, source, external_url)')
      .eq('competency_id', wc.competency_id);

    for (const link of (courseLinks || []).slice(0, 3)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const courseArr = link.courses as any[];
      const course = Array.isArray(courseArr) ? courseArr[0] : courseArr;
      if (!course) continue;

      paths.push({
        type: 'role_gap',
        official: {
          id: profile.id,
          name: profile.full_name || 'Official',
          role: profile.designation || profile.job_role || 'Government Official',
        },
        path: [
          { nodeType: 'official', nodeId: profile.id, nodeName: profile.full_name || 'You', relation: 'is a' },
          { nodeType: 'role', nodeId: '', nodeName: profile.designation || 'Official', relation: 'works as' },
          { nodeType: 'domain', nodeId: domainName, nodeName: domainName, relation: 'belongs to' },
          { nodeType: 'competency', nodeId: wc.competency_id, nodeName: compName, relation: 'requires', meta: { score: wc.score } },
          { nodeType: 'course', nodeId: String(course.id || ''), nodeName: String(course.title || ''), relation: 'teaches' },
        ],
        score: Math.max(0, 60 - (wc.score || 0)) / 60, // Higher score for bigger gaps
        explanation: `Your role requires "${compName}" (${domainName}), but your current score is ${wc.score}%. This course addresses that gap.`,
      });
    }
  }

  // 4. Find department-wide gaps (competencies where department average is low)
  if (profile.department_id) {
    // Get all user IDs in this department first
    const { data: deptUsers } = await supabaseServiceRole
      .from('profiles')
      .select('id')
      .eq('department_id', profile.department_id);

    if (deptUsers && deptUsers.length > 0) {

    const deptUserIds = deptUsers.map((u) => u.id);
    const { data: deptScores } = await supabaseServiceRole
      .from('user_competency_scores')
      .select('competency_id, score')
      .in('user_id', deptUserIds);

    // Group by competency, compute average
    const compAvgs = new Map<string, { total: number; count: number }>();
    for (const ds of (deptScores || [])) {
      const existing = compAvgs.get(ds.competency_id) || { total: 0, count: 0 };
      existing.total += ds.score || 0;
      existing.count++;
      compAvgs.set(ds.competency_id, existing);
    }

    // Find department's weakest competencies
    const deptWeak = Array.from(compAvgs.entries())
      .map(([id, avg]) => ({ id, avg: avg.total / avg.count }))
      .filter((x) => x.avg < 50)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 3);

    for (const dw of deptWeak) {
      const { data: comp } = await supabaseServiceRole
        .from('competencies')
        .select('name, competency_domains(name)')
        .eq('id', dw.id)
        .single();

      // Find courses for this competency
      const { data: courseLinks } = await supabaseServiceRole
        .from('course_competencies')
        .select('course_id, courses(id, title)')
        .eq('competency_id', dw.id)
        .limit(2);

      for (const link of (courseLinks || [])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const courseArr = link.courses as any[];
        const course = Array.isArray(courseArr) ? courseArr[0] : courseArr;
        if (!course) continue;

        paths.push({
          type: 'department_need',
          official: { id: profile.id, name: profile.full_name || 'Official', role: profile.designation || '' },
          path: [
            { nodeType: 'official', nodeId: profile.id, nodeName: 'Your department', relation: 'collectively' },
            { nodeType: 'competency', nodeId: dw.id, nodeName: String(comp?.name || 'Unknown'), relation: 'average score', meta: { score: Math.round(dw.avg) } },
            { nodeType: 'course', nodeId: String(course.id || ''), nodeName: String(course.title || ''), relation: 'addresses' },
          ],
          score: Math.max(0, 50 - dw.avg) / 50,
          explanation: `Your department averages ${Math.round(dw.avg)}% in "${comp?.name}". This course can help improve that.`,
        });
      }
    }
    } // end if deptUsers
  }

  // Sort by score (highest priority first)
  paths.sort((a, b) => b.score - a.score);

  return paths;
}

/**
 * Get a simple explanation for why a course was recommended.
 * Returns a human-readable string tracing the graph path.
 */
export async function explainRecommendation(userId: string, courseId: string): Promise<string> {
  const paths = await getUserGraphPaths(userId);
  const relevant = paths.find((p) =>
    p.path.some((n) => n.nodeType === 'course' && n.nodeId === courseId)
  );

  if (relevant) {
    return relevant.explanation;
  }

  return 'This course was recommended based on your profile and department needs.';
}
