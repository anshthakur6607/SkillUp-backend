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
  // Use the database function for aggregated heatmap data
  const { data: rows, error } = await supabaseServiceRole
    .rpc('get_skill_heatmap');

  if (error || !rows || rows.length === 0) {
    // Fallback: return empty heatmap
    return {
      departments: [],
      competencies: [],
      cells: [],
      summary: {
        overallAverage: 0,
        weakestDepartment: '',
        strongestDepartment: '',
        weakestCompetency: '',
        strongestCompetency: '',
      },
    };
  }

  // Transform database rows into heatmap cells
  const typedRows = rows as Array<Record<string, unknown>>;
  const departments: string[] = [...new Set(typedRows.map((r) => String(r.department || '')))];
  const competencies: string[] = [...new Set(typedRows.map((r) => {
    const domain = String(r.domain_name || '');
    const name = String(r.competency_name || '');
    return domain ? `${domain}: ${name}` : name;
  }))];

  const cells: HeatmapCell[] = typedRows.map((r) => {
    const avgScore = Number(r.avg_score) || 0;
    let level: 'weak' | 'moderate' | 'strong';
    if (avgScore < 40) level = 'weak';
    else if (avgScore < 70) level = 'moderate';
    else level = 'strong';

    return {
      department: r.department as string,
      competency: r.domain_name ? `${r.domain_name}: ${r.competency_name}` : r.competency_name as string,
      avgScore,
      userCount: Number(r.user_count) || 0,
      level,
    };
  });

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
