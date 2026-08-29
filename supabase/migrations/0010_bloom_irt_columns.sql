-- =============================================================================
-- Migration 0010: Bloom's Taxonomy + IRT Calibration Columns
-- =============================================================================
-- Adds:
--   1. bloom_level on assessment_answers (which Bloom's level each question targets)
--   2. IRT parameters (a, b, c) on assessment_answers for adaptive calibration
--   3. bloom_level column on assessment_attempts for overall Bloom's distribution
-- =============================================================================

-- Bloom's taxonomy enum
DO $$ BEGIN
  CREATE TYPE public.bloom_level AS ENUM (
    'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add bloom_level and IRT parameters to assessment_answers
ALTER TABLE public.assessment_answers
  ADD COLUMN IF NOT EXISTS bloom_level public.bloom_level,
  ADD COLUMN IF NOT EXISTS irt_a DECIMAL(4,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS irt_b DECIMAL(4,2) DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS irt_c DECIMAL(4,2) DEFAULT 0.20;

COMMENT ON COLUMN public.assessment_answers.bloom_level IS
  'Bloom''s taxonomy level this question targets: remember, understand, apply, analyze, evaluate, create.';
COMMENT ON COLUMN public.assessment_answers.irt_a IS
  'IRT discrimination parameter — how well this question separates high/low ability learners.';
COMMENT ON COLUMN public.assessment_answers.irt_b IS
  'IRT difficulty parameter — ability level at which P(correct) = 0.5.';
COMMENT ON COLUMN public.assessment_answers.irt_c IS
  'IRT guessing parameter — probability of correct answer by chance.';

-- Add Bloom's distribution summary to assessment_attempts
ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS bloom_distribution JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_ability DECIMAL(4,2) DEFAULT 0.0;

COMMENT ON COLUMN public.assessment_attempts.bloom_distribution IS
  'JSON object counting correct answers per Bloom level, e.g. {"remember":2,"apply":1}';
COMMENT ON COLUMN public.assessment_attempts.estimated_ability IS
  'IRT ability estimate (theta) after this assessment attempt. Range: -3 to 3.';
