-- =============================================================================
-- Migration: 0004_competency_framework.sql
-- Purpose:   Create the competency framework tables: domains, competencies,
--            and per-user competency scores.
--
--            This is the intellectual backbone of the platform — it defines
--            WHAT skills we're measuring and WHO has which skills.
-- =============================================================================

-- =============================================================================
-- TABLE: competency_domains
-- =============================================================================
-- Top-level groupings of competencies. Per the requirement doc, these are:
--   1. Statistical
--   2. Technical
--   3. Digital Governance
--   4. Behavioural & Managerial
--
-- These domains appear on dashboards and in gap analysis views.
-- =============================================================================
CREATE TABLE public.competency_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.competency_domains IS
  'Top-level competency groupings (Statistical, Technical, Digital Governance, Behavioural & Managerial). Used on dashboards and in gap analysis.';

-- =============================================================================
-- TABLE: competencies
-- =============================================================================
-- Individual skills/competencies, each belonging to exactly one domain.
-- Examples: "Survey Design", "Python", "Data Privacy", "Leadership"
--
-- Each competency can be linked to:
--   - Survey questions (to measure the user's self-assessed level)
--   - Courses (to show which courses address this competency)
--   - Assessment questions (to test this competency)
--   - User scores (to track each user's current level)
-- =============================================================================
CREATE TABLE public.competencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id   uuid NOT NULL REFERENCES public.competency_domains(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.competencies IS
  'Individual competencies (skills) grouped under a domain. Each can be linked to surveys, courses, assessments, and user scores.';

COMMENT ON COLUMN public.competencies.domain_id IS
  'FK to competency_domains. CASCADE delete: if a domain is removed, its competencies go too (they have no meaning without a domain).';

-- =============================================================================
-- TABLE: user_competency_scores
-- =============================================================================
-- Per-user, per-competency current score/level. This is the central table
-- that dashboards and gap analysis read from.
--
-- A user's score is updated over time as they complete surveys, courses,
-- and assessments. The "score" is a numeric value (e.g. 1-5 scale or
-- percentage) that represents their current proficiency level.
--
-- We store the CURRENT score only (not history). If we later need history,
-- we can add a user_competency_score_history table or use audit logging.
-- =============================================================================
CREATE TABLE public.user_competency_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  score           numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  last_assessed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One score per user per competency — no duplicates
  UNIQUE (user_id, competency_id)
);

COMMENT ON TABLE public.user_competency_scores IS
  'Current competency score per user. This is the primary table read by dashboards and gap analysis. One row per user per competency.';

COMMENT ON COLUMN public.user_competency_scores.score IS
  'Current proficiency score (0-100). Updated as the user completes surveys, courses, and assessments.';

COMMENT ON COLUMN public.user_competency_scores.last_assessed_at IS
  'Timestamp of the most recent assessment/survey that updated this score. NULL if never assessed.';

CREATE TRIGGER user_competency_scores_set_updated_at
  BEFORE UPDATE ON public.user_competency_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS: competency_domains
-- =============================================================================
-- Reference/catalogue data: any authenticated user can read the domain list.
-- Only admins can create, edit, or delete domains.
-- Anonymous access is blocked.
-- =============================================================================
ALTER TABLE public.competency_domains ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "competency_domains_select_authenticated" ON public.competency_domains IS
  'Authenticated users can view competency domains (needed for dashboards and UI).';

CREATE POLICY "competency_domains_select_authenticated"
  ON public.competency_domains FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "competency_domains_insert_admin" ON public.competency_domains IS
  'Only admins can create new competency domains.';

CREATE POLICY "competency_domains_insert_admin"
  ON public.competency_domains FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "competency_domains_update_admin" ON public.competency_domains IS
  'Only admins can modify competency domain details.';

CREATE POLICY "competency_domains_update_admin"
  ON public.competency_domains FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "competency_domains_delete_admin" ON public.competency_domains IS
  'Only admins can delete competency domains.';

CREATE POLICY "competency_domains_delete_admin"
  ON public.competency_domains FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: competencies
-- =============================================================================
-- Same pattern as domains: authenticated read, admin-only write.
-- Anonymous access is blocked.
-- =============================================================================
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "competencies_select_authenticated" ON public.competencies IS
  'Authenticated users can view competencies (needed for dashboards, surveys, and course details).';

CREATE POLICY "competencies_select_authenticated"
  ON public.competencies FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "competencies_insert_admin" ON public.competencies IS
  'Only admins can create new competencies.';

CREATE POLICY "competencies_insert_admin"
  ON public.competencies FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "competencies_update_admin" ON public.competencies IS
  'Only admins can modify competency details.';

CREATE POLICY "competencies_update_admin"
  ON public.competencies FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "competencies_delete_admin" ON public.competencies IS
  'Only admins can delete competencies.';

CREATE POLICY "competencies_delete_admin"
  ON public.competencies FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: user_competency_scores
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own scores (user_id = aut
-- =============================================================================
-- RLS: user_competency_scores
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own scores (user_id = auth.uid())
--     - Admins can see all scores
--     - Managers can see aggregated (not individual) scores for their department
--       NOTE: True aggregation should be done via a security-definer function
--       or a view that returns only numbers, not row-level access. See the
--       docs-hum file for details on the aggregation-only pattern.
--   INSERT/UPDATE:
--     - Users cannot insert or update their own scores directly.
--       Scores are updated by the system (server-side) after surveys,
--       courses, and assessments are completed. This prevents users from
--       inflating their own scores.
--       INSERT and UPDATE are done via service role only.
--   DELETE:
--     - No delete policy = blocked by default. Scores should never be
--       deleted, only overwritten by newer assessments.
-- =============================================================================
ALTER TABLE public.user_competency_scores ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "scores_select_own" ON public.user_competency_scores IS
  'Users can see their own competency scores — this powers their personal dashboard.';

CREATE POLICY "scores_select_own"
  ON public.user_competency_scores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "scores_select_admin" ON public.user_competency_scores IS
  'Admins can see all competency scores — needed for system-wide analytics.';

CREATE POLICY "scores_select_admin"
  ON public.user_competency_scores FOR SELECT
  TO authenticated
  USING (is_admin());

-- No manager SELECT policy for scores — managers must NOT have row-level
-- access to individual employee scores. Aggregated department statistics
-- should be provided via a security-definer function or view that returns
-- only aggregate numbers.

-- No INSERT/UPDATE/DELETE policies for authenticated users — scores are
-- managed exclusively by the server (service role) after completing
-- surveys, courses, and assessments. This prevents score tampering.
