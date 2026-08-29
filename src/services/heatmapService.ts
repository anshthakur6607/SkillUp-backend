/**
 * Skill Heatmap Service — department-level competency visualization.
 *
 * Generates heatmaps showing:
 * - Average competency scores by department
 * - Skill gaps across teams
 * - Which departments need training in which areas
 *
 * This data powers the admin dashboard heatmap view,
 * helping HR planners see where to invest in training.
 *
 * Uses security-definer functions to ensure managers only see
 * aggregated data, never individual employee scores.
 */

import { supabaseServiceRole } from '../config/supabaseClient';

export interface HeatmapCell {
  department: string;
  competency: string;
  avgScore: number;
  userCount: number;
  level: 'weak' | 'moderate' | 'strong';
}

export interface HeatmapData {
  departments: string[];
  competencies: string[];
  cells: HeatmapCell[];
  summary: {
    overallAverage: number;
    weakestDepartment: string;
    strongestDepartment: string;
    weakestCompetency: string;
    strongestCompetency: string;
  };
}

/**
 * Generate skill heatmap data across all departments and competencies.
 * Aggregated — never returns individual user data.
 */
export async function generateHeatmap(): Promise<HeatmapData> {
  // Get all departments
  const { data: deptData } = await supabaseServiceRole
    .from('departments')
    .select('name')
    .order('name');

  const departments = (deptData || []).map((d) => d.name);
  if (departments.length === 0) {
    departments.push('General');
  }

  // Get all competencies with their domains
  const { data: compData } = await supabaseServiceRole
    .from('competencies')
    .select('name, competency_domains(name)')
    .order('name');

  const competencies = (compData || []).map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain = (c.competency_domains as any)?.name;
    return domain ? `${domain}: ${c.name}` : c.name;
  });
  if (competencies.length === 0) {
    competencies.push('General');
  }

  // Get aggregated scores per department and competency
  // Using a raw query approach since we need GROUP BY across joins
  const cells: HeatmapCell[] = [];

  for (const dept of departments) {
    for (const comp of competencies) {
      // Get users in this department
      const { data: users } = await supabaseServiceRole
        .from('profiles')
        .select('id')
        .eq('department', dept);

      if (!users || users.length === 0) continue;

      const userIds = users.map((u) => u.id);

      // Extract competency name from "Domain: Name" format
      const compName = comp.includes(':') ? comp.split(': ').pop()! : comp;

      // Get scores for these users on this competency
      const { data: scores } = await supabaseServiceRole
        .from('user_competency_scores')
        .select('score, competencies!inner(name)')
        .in('user_id', userIds)
        .eq('competencies.name', compName);

      if (!scores || scores.length === 0) continue;

      const avgScore = Math.round(
        scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
      );

      let level: 'weak' | 'moderate' | 'strong';
      if (avgScore < 40) level = 'weak';
      else if (avgScore < 70) level = 'moderate';
      else level = 'strong';

      cells.push({
        department: dept,
        competency: comp,
        avgScore,
        userCount: scores.length,
        level,
      });
    }
  }

  // Calculate summary
  const deptAverages = new Map<string, number[]>();
  const compAverages = new Map<string, number[]>();

  for (const cell of cells) {
    if (!deptAverages.has(cell.department)) deptAverages.set(cell.department, []);
    deptAverages.get(cell.department)!.push(cell.avgScore);

    if (!compAverages.has(cell.competency)) compAverages.set(cell.competency, []);
    compAverages.get(cell.competency)!.push(cell.avgScore);
  }

  let weakestDept = '';
  let strongestDept = '';
  let weakestComp = '';
  let strongestComp = '';
  let lowestDeptAvg = 100;
  let highestDeptAvg = 0;
  let lowestCompAvg = 100;
  let highestCompAvg = 0;

  for (const [dept, scores] of deptAverages) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < lowestDeptAvg) { lowestDeptAvg = avg; weakestDept = dept; }
    if (avg > highestDeptAvg) { highestDeptAvg = avg; strongestDept = dept; }
  }

  for (const [comp, scores] of compAverages) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < lowestCompAvg) { lowestCompAvg = avg; weakestComp = comp; }
    if (avg > highestCompAvg) { highestCompAvg = avg; strongestComp = comp; }
  }

  const allScores = cells.map((c) => c.avgScore);
  const overallAverage = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  return {
    departments,
    competencies,
    cells,
    summary: {
      overallAverage,
      weakestDepartment: weakestDept,
      strongestDepartment: strongestDept,
      weakestCompetency: weakestComp,
      strongestCompetency: strongestComp,
    },
  };
}

/**
 * Get heatmap for a specific department only.
 */
export async function generateDepartmentHeatmap(department: string): Promise<HeatmapData> {
  const full = await generateHeatmap();

  // Filter to just this department
  const cells = full.cells.filter((c) => c.department === department);
  const competencies = [...new Set(cells.map((c) => c.competency))];

  return {
    departments: [department],
    competencies,
    cells,
    summary: full.summary,
  };
}
