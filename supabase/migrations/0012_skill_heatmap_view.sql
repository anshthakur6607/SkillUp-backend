-- =============================================================================
-- Migration 0012: Skill Heatmap Aggregated View
-- =============================================================================
-- Creates a security-definer function that returns aggregated competency
-- scores by department, so managers see department-level stats without
-- accessing individual employee data.
-- =============================================================================

-- Function: get_skill_heatmap()
-- Returns aggregated competency scores per department.
-- Uses SECURITY DEFINER so it bypasses RLS for the aggregation,
-- but the aggregation itself never exposes individual user data.
CREATE OR REPLACE FUNCTION public.get_skill_heatmap()
RETURNS TABLE (
  department TEXT,
  competency_name TEXT,
  domain_name TEXT,
  avg_score DECIMAL(5,1),
  user_count BIGINT,
  min_score DECIMAL(5,1),
  max_score DECIMAL(5,1)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(d.name, 'Unassigned')::TEXT,
    c.name::TEXT AS competency_name,
    cd.name::TEXT AS domain_name,
    ROUND(AVG(ucs.score), 1)::DECIMAL(5,1) AS avg_score,
    COUNT(DISTINCT ucs.user_id)::BIGINT AS user_count,
    ROUND(MIN(ucs.score), 1)::DECIMAL(5,1) AS min_score,
    ROUND(MAX(ucs.score), 1)::DECIMAL(5,1) AS max_score
  FROM public.user_competency_scores ucs
  JOIN public.competencies c ON c.id = ucs.competency_id
  JOIN public.competency_domains cd ON cd.id = c.domain_id
  JOIN public.profiles p ON p.id = ucs.user_id
  LEFT JOIN public.departments d ON d.id = p.department_id
  GROUP BY d.name, c.name, cd.name
  ORDER BY d.name, avg_score ASC;
END;
$$;

COMMENT ON FUNCTION public.get_skill_heatmap() IS
  'Returns aggregated competency scores per department. SECURITY DEFINER so it
   bypasses RLS, but the aggregation never exposes individual user rows — only
   department-level averages, counts, min/max. Managers can see where their
   department is weak without seeing individual employee scores.';

-- Grant execute to authenticated users (they need to see heatmap data)
GRANT EXECUTE ON FUNCTION public.get_skill_heatmap() TO authenticated;

-- Function: get_department_heatmap(p_department TEXT)
-- Returns aggregated scores for a single department.
CREATE OR REPLACE FUNCTION public.get_department_heatmap(p_department TEXT)
RETURNS TABLE (
  department TEXT,
  competency_name TEXT,
  domain_name TEXT,
  avg_score DECIMAL(5,1),
  user_count BIGINT,
  min_score DECIMAL(5,1),
  max_score DECIMAL(5,1)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(d.name, 'Unassigned')::TEXT,
    c.name::TEXT AS competency_name,
    cd.name::TEXT AS domain_name,
    ROUND(AVG(ucs.score), 1)::DECIMAL(5,1) AS avg_score,
    COUNT(DISTINCT ucs.user_id)::BIGINT AS user_count,
    ROUND(MIN(ucs.score), 1)::DECIMAL(5,1) AS min_score,
    ROUND(MAX(ucs.score), 1)::DECIMAL(5,1) AS max_score
  FROM public.user_competency_scores ucs
  JOIN public.competencies c ON c.id = ucs.competency_id
  JOIN public.competency_domains cd ON cd.id = c.domain_id
  JOIN public.profiles p ON p.id = ucs.user_id
  LEFT JOIN public.departments d ON d.id = p.department_id
  WHERE d.name = p_department
  GROUP BY d.name, c.name, cd.name
  ORDER BY avg_score ASC;
END;
$$;

COMMENT ON FUNCTION public.get_department_heatmap(TEXT) IS
  'Returns aggregated competency scores for a single department only.
   Used for detailed drill-down view of one department''s skill gaps.';

GRANT EXECUTE ON FUNCTION public.get_department_heatmap(TEXT) TO authenticated;

-- View: v_skill_heatmap_summary
-- Quick summary stats per department.
CREATE OR REPLACE VIEW public.v_skill_heatmap_summary AS
SELECT
  COALESCE(d.name, 'Unassigned') AS department,
  COUNT(DISTINCT ucs.user_id) AS total_users,
  ROUND(AVG(ucs.score), 1) AS overall_avg,
  COUNT(DISTINCT ucs.competency_id) AS competencies_tracked,
  MIN(ucs.score) AS lowest_score,
  MAX(ucs.score) AS highest_score
FROM public.user_competency_scores ucs
JOIN public.profiles p ON p.id = ucs.user_id
LEFT JOIN public.departments d ON d.id = p.department_id
GROUP BY d.name
ORDER BY overall_avg ASC;

COMMENT ON VIEW public.v_skill_heatmap_summary IS
  'Department-level summary of competency tracking. Shows average scores
   and coverage per department for HR planning.';
