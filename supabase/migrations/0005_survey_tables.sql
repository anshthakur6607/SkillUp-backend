-- =============================================================================
-- Migration: 0005_survey_tables.sql
-- Purpose:   Create survey tables: questions and responses.
--
--            Surveys are used for self-assessment — employees answer
--            competency-related questions to establish their baseline
--            skill levels. The scores feed into user_competency_scores.
-- =============================================================================

-- =============================================================================
-- TABLE: survey_questions
-- =============================================================================
-- Individual survey questions, each linked to a competency.
-- Questions can optionally be scoped to specific designations or departments
-- (e.g. "this question is only relevant to Statistical Officers").
-- If both designation_scope and department_scope are NULL, the question
-- applies to everyone.
-- =============================================================================
CREATE TABLE public.survey_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id     uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  question_text     text NOT NULL,
  description       text,                   -- additional context or instructions
  designation_scope text,                   -- NULL = applies to all designations
  department_scope  uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.survey_questions IS
  'Self-assessment survey questions. Each is linked to a competency and optionally scoped to specific designations/departments.';

COMMENT ON COLUMN public.survey_questions.designation_scope IS
  'If set, only users with this designation see the question. NULL means it applies to everyone.';

COMMENT ON COLUMN public.survey_questions.department_scope IS
  'FK to departments. If set, only users in this department see the question. NULL means it applies to all departments.';

COMMENT ON COLUMN public.survey_questions.is_active IS
  'Soft-delete flag. Inactive questions are not shown in surveys but responses are preserved.';

CREATE TRIGGER survey_questions_set_updated_at
  BEFORE UPDATE ON public.survey_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: survey_responses
-- =============================================================================
-- Per-user answers to survey questions. Each response records the user's
-- self-assessed score for a specific question.
--
-- A user can respond to the same question multiple times (e.g. after
-- retaking a survey), but we keep all responses for historical tracking.
-- The most recent response per user per question is the "current" score.
-- =============================================================================
CREATE TABLE public.survey_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  score       numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  answered_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.survey_responses IS
  'Individual survey answers. Each row is one user''s response to one question. Multiple responses per user per question are allowed (tracks history).';

COMMENT ON COLUMN public.survey_responses.score IS
  'Self-assessed score (0-100) for this competency question.';

COMMENT ON COLUMN public.survey_responses.answered_at IS
  'When the user submitted this response. Differs from created_at if imported from an external system.';

-- =============================================================================
-- RLS: survey_questions
-- =============================================================================
-- Reference/catalogue data: any authenticated user can read active questions.
-- Only admins can create, edit, or deactivate questions.
-- Anonymous access is blocked.
-- =============================================================================
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "survey_questions_select_authenticated" ON public.survey_questions IS
  'Authenticated users can view active survey questions (needed to take surveys).';

CREATE POLICY "survey_questions_select_authenticated"
  ON public.survey_questions FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON POLICY "survey_questions_insert_admin" ON public.survey_questions IS
  'Only admins can create new survey questions.';

CREATE POLICY "survey_questions_insert_admin"
  ON public.survey_questions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "survey_questions_update_admin" ON public.survey_questions IS
  'Only admins can modify survey questions (text, scope, active status).';

CREATE POLICY "survey_questions_update_admin"
  ON public.survey_questions FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "survey_questions_delete_admin" ON public.survey_questions IS
  'Only admins can delete survey questions. Prefer deactivating (is_active = false) to preserve response history.';

CREATE POLICY "survey_questions_delete_admin"
  ON public.survey_questions FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: survey_responses
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own responses (user_id = auth.uid())
--     - Admins can see all responses
--     - Managers must NOT see individual employee responses (privacy).
--       Aggregated department statistics should be provided via a
--       security-definer function or view.
--   INSERT:
--     - Users can insert their own responses (user_id = auth.uid())
--       This is the only write operation allowed — users submit their
--       own survey answers.
--   UPDATE/DELETE:
--     - No policies = blocked by default. Survey responses are append-only.
--       Once submitted, they cannot be modified or deleted — this preserves
--       the integrity of the self-assessment history.
-- =============================================================================
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "survey_responses_select_own" ON public.survey_responses IS
  'Users can see their own survey responses — needed to review their self-assessment history.';

CREATE POLICY "survey_responses_select_own"
  ON public.survey_responses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "survey_responses_select_admin" ON public.survey_responses IS
  'Admins can see all survey responses — needed for system-wide analytics and data management.';

CREATE POLICY "survey_responses_select_admin"
  ON public.survey_responses FOR SELECT
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "survey_responses_insert_own" ON public.survey_responses IS
  'Users can submit their own survey responses. The user_id must match auth.uid().';

CREATE POLICY "survey_responses_insert_own"
  ON public.survey_responses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policies — survey responses are append-only.
-- Once a user submits a survey answer, it cannot be changed or removed.
-- This prevents users from retroactively altering their self-assessment history.
