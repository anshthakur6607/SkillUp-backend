-- =============================================================================
-- Migration: 0007_assessment_tables.sql
-- Purpose:   Create assessment tables: assessments, questions, attempts,
--            and answers.
--
--            Assessments are linked to courses and test the user's mastery
--            of competencies covered by that course. The "where am I going
--            wrong" feature will read from assessment_answers to identify
--            weak areas by competency and difficulty level.
-- =============================================================================

-- =============================================================================
-- TABLE: assessments
-- =============================================================================
-- Each assessment is linked to a course and has a pass threshold score.
-- A course can have multiple assessments (e.g. mid-term, final).
-- =============================================================================
CREATE TABLE public.assessments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  pass_threshold  numeric NOT NULL DEFAULT 60 CHECK (pass_threshold > 0 AND pass_threshold <= 100),
  time_limit_minutes integer CHECK (time_limit_minutes > 0),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessments IS
  'Assessment definitions linked to courses. Each has a pass threshold and optional time limit.';

COMMENT ON COLUMN public.assessments.pass_threshold IS
  'Minimum score (0-100) needed to pass. Default 60%.';

COMMENT ON COLUMN public.assessments.time_limit_minutes IS
  'Optional time limit in minutes. NULL means no time limit.';

CREATE TRIGGER assessments_set_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: assessment_questions
-- =============================================================================
-- Individual questions within an assessment. Each is tagged with:
--   - A competency_id: what skill this question tests
--   - A difficulty level: beginner, intermediate, advanced, or critical
--
-- The difficulty tag is critical for the "where am I going wrong" feature:
-- if a user consistently fails "advanced" questions on a competency, the
-- chatbot can recommend specific intermediate courses before retrying.
-- =============================================================================
CREATE TABLE public.assessment_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  options         jsonb NOT NULL,           -- e.g. ["Option A", "Option B", "Option C", "Option D"]
  correct_answer  text NOT NULL,            -- the correct option text or index
  difficulty      difficulty_level NOT NULL DEFAULT 'intermediate',
  points          integer NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_questions IS
  'Individual assessment questions. Tagged with competency and difficulty for weak-area analysis.';

COMMENT ON COLUMN public.assessment_questions.options IS
  'JSON array of answer options, e.g. ["Option A", "Option B", "Option C", "Option D"].';

COMMENT ON COLUMN public.assessment_questions.correct_answer IS
  'The correct answer text (or option index). Used for auto-grading.';

COMMENT ON COLUMN public.assessment_questions.difficulty IS
  'Difficulty level: beginner, intermediate, advanced, critical. Critical for "where am I going wrong" analysis.';

COMMENT ON COLUMN public.assessment_questions.points IS
  'Points awarded for a correct answer. Default 1. Allows weighted scoring.';

COMMENT ON COLUMN public.assessment_questions.sort_order IS
  'Display order within the assessment. Lower numbers appear first.';

-- =============================================================================
-- TABLE: assessment_attempts
-- =============================================================================
-- Per-user attempt record for an assessment. Tracks when the user started
-- and finished, their total score, and whether they passed.
--
-- SECURITY: This table is INSERT-ONLY for authenticated users. Once an
-- attempt is recorded, it CANNOT be updated or deleted by the user — this
-- prevents tampering with exam results. Only the server (via service role)
-- creates attempt records.
-- =============================================================================
CREATE TABLE public.assessment_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_id   uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  score           numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  passed          boolean NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_attempts IS
  'Per-user assessment attempt records. INSERT-ONLY for authenticated users — prevents tampering with exam results.';

COMMENT ON COLUMN public.assessment_attempts.score IS
  'Total score as a percentage (0-100). Calculated server-side after grading all answers.';

COMMENT ON COLUMN public.assessment_attempts.passed IS
  'Whether the user passed (score >= assessment.pass_threshold).';

COMMENT ON COLUMN public.assessment_attempts.completed_at IS
  'NULL until the attempt is submitted. Set when the user finishes or time runs out.';

-- =============================================================================
-- TABLE: assessment_answers
-- =============================================================================
-- Per-question answer within an attempt. This is the granular data that
-- feeds the "where am I going wrong" feature and the AI chatbot.
--
-- SECURITY: Same as assessment_attempts — INSERT-ONLY for authenticated
-- users. Once recorded, answers cannot be changed. This is critical for
-- maintaining the integrity of assessment results.
-- =============================================================================
CREATE TABLE public.assessment_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      uuid NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  selected_answer text NOT NULL,
  correct         boolean NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- One answer per question per attempt
  UNIQUE (attempt_id, question_id)
);

COMMENT ON TABLE public.assessment_answers IS
  'Individual question answers within an attempt. INSERT-ONLY — the granular data that powers weak-area analysis and the AI chatbot.';

COMMENT ON COLUMN public.assessment_answers.selected_answer IS
  'The answer the user selected or typed. Stored as text for audit trail.';

COMMENT ON COLUMN public.assessment_answers.correct IS
  'Whether this answer was correct. Computed server-side during grading.';

-- =============================================================================
-- RLS: assessments
-- =============================================================================
-- Reference/catalogue data: any authenticated user can read assessments.
-- Only admins can create, edit, or deactivate assessments.
-- Anonymous access is blocked.
-- ==========================================================
-- =============================================================================
-- RLS: assessments
-- =============================================================================
-- Reference/catalogue data: any authenticated user can read assessments.
-- Only admins can create, edit, or deactivate assessments.
-- Anonymous access is blocked.
-- =============================================================================
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "assessments_select_authenticated" ON public.assessments IS
  'Authenticated users can view active assessments (needed to take assessments for enrolled courses).';

CREATE POLICY "assessments_select_authenticated"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON POLICY "assessments_insert_admin" ON public.assessments IS
  'Only admins can create new assessments.';

CREATE POLICY "assessments_insert_admin"
  ON public.assessments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "assessments_update_admin" ON public.assessments IS
  'Only admins can modify assessment details.';

CREATE POLICY "assessments_update_admin"
  ON public.assessments FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "assessments_delete_admin" ON public.assessments IS
  'Only admins can delete assessments.';

CREATE POLICY "assessments_delete_admin"
  ON public.assessments FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: assessment_questions
-- =============================================================================
-- Questions are reference data: authenticated users need to read them
-- (to display during an assessment). Only admins can manage questions.
-- IMPORTANT: We do NOT expose correct_answer through RLS — the correct
-- answer is only checked server-side during grading, never sent to the
-- client. RLS controls row access, not column access, so this is handled
-- at the application layer.
-- =============================================================================
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "assessment_questions_select_authenticated" ON public.assessment_questions IS
  'Authenticated users can view assessment questions (needed to display during assessments).';

CREATE POLICY "assessment_questions_select_authenticated"
  ON public.assessment_questions FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "assessment_questions_insert_admin" ON public.assessment_questions IS
  'Only admins can create assessment questions.';

CREATE POLICY "assessment_questions_insert_admin"
  ON public.assessment_questions FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "assessment_questions_update_admin" ON public.assessment_questions IS
  'Only admins can modify assessment questions.';

CREATE POLICY "assessment_questions_update_admin"
  ON public.assessment_questions FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "assessment_questions_delete_admin" ON public.assessment_questions IS
  'Only admins can delete assessment questions.';

CREATE POLICY "assessment_questions_delete_admin"
  ON public.assessment_questions FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: assessment_attempts
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own attempts (user_id = auth.uid())
--     - Admins can see all attempts
--     - Managers can see aggregated pass/fail rates for their department,
--       NOT individual attempt details. True aggregation should be done
--       via a security-definer function.
--   INSERT:
--     - No INSERT policy for authenticated users = blocked by default.
--       Attempts are created exclusively by the server (service role)
--       after the user submits their answers. This prevents users from
--       creating fake passing attempts.
--   UPDATE/DELETE:
--     - No policies = blocked by default. Attempts are permanent records.
--       Once submitted, they cannot be changed or removed — this is the
--       most critical anti-tampering measure in the system.
-- =============================================================================
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "assessment_attempts_select_own" ON public.assessment_attempts IS
  'Users can see their own assessment attempts — needed to review past results.';

CREATE POLICY "assessment_attempts_select_own"
  ON public.assessment_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "assessment_attempts_select_admin" ON public.assessment_attempts IS
  'Admins can see all assessment attempts — needed for analytics and audit.';

CREATE POLICY "assessment_attempts_select_admin"
  ON public.assessment_attempts FOR SELECT
  TO authenticated
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Assessment attempts are created, graded, and stored exclusively by the
-- server (service role). This is the strongest anti-tampering guarantee:
-- even if application code has a bug, users CANNOT create, modify, or
-- delete their own exam records through the database.

-- =============================================================================
-- RLS: assessment_answers
-- =============================================================================
-- Same strict pattern as assessment_attempts: SELECT own + admin, no writes.
-- =============================================================================
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "assessment_answers_select_own" ON public.assessment_answers IS
  'Users can see their own assessment answers — needed for the "where did I go wrong" review.';

CREATE POLICY "assessment_answers_select_own"
  ON public.assessment_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_attempts
      WHERE id = assessment_answers.attempt_id
        AND user_id = auth.uid()
    )
  );

COMMENT ON POLICY "assessment_answers_select_admin" ON public.assessment_answers IS
  'Admins can see all assessment answers — needed for analytics and audit.';

CREATE POLICY "assessment_answers_select_admin"
  ON public.assessment_answers FOR SELECT
  TO authenticated
  USING (is_admin());

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Answers are recorded exclusively by the server during grading.
-- The assessment_answers table is the foundation for:
--   - "Where am I going wrong?" feature (weak-area analysis by competency)
--   - AI chatbot recommendations (which courses to take next)
--   - Department-level analytics (via security-definer aggregation functions)
