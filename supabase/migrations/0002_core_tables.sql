-- =============================================================================
-- Migration: 0002_core_tables.sql
-- Purpose:   Create ALL core database tables without RLS or triggers.
--
--            WHY NO RLS HERE?
--            RLS policies in later migrations call is_admin() and is_manager_of(),
--            which are defined in migration 0003. If we enabled RLS here, those
--            policies wouldn't exist yet and queries would silently fail.
--
--            WHY NO TRIGGERS HERE?
--            Triggers like set_updated_at() are defined in 0003. We add them
--            in migration 0004 after the functions exist.
--
--            This migration is PURELY table definitions — safe, no dependencies.
-- =============================================================================

-- =============================================================================
-- TABLE: departments
-- =============================================================================
CREATE TABLE public.departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  code        text UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments IS
  'Lookup table of government departments. Normalised to prevent inconsistent naming.';

-- =============================================================================
-- TABLE: profiles
-- =============================================================================
CREATE TABLE public.profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          text NOT NULL,
  email              text UNIQUE,
  designation        text,
  department_id      uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_role           text,
  education          text,
  years_of_experience integer CHECK (years_of_experience >= 0),
  role               user_role NOT NULL DEFAULT 'employee',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'One row per authenticated user. Links to auth.users for identity. The role column controls RLS access throughout the entire system.';
COMMENT ON COLUMN public.profiles.role IS
  'Determines system-wide access level. employee = own data only. manager = aggregated department data. admin = full access.';
COMMENT ON COLUMN public.profiles.department_id IS
  'FK to departments. SET NULL on delete preserves the profile if a department is removed (audit trail).';

-- =============================================================================
-- TABLE: competency_domains
-- =============================================================================
CREATE TABLE public.competency_domains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.competency_domains IS
  'Top-level competency groupings (Statistical, Technical, Digital Governance, Behavioural & Managerial).';

-- =============================================================================
-- TABLE: competencies
-- =============================================================================
CREATE TABLE public.competencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id   uuid NOT NULL REFERENCES public.competency_domains(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.competencies IS
  'Individual competencies (skills) grouped under a domain.';

-- =============================================================================
-- TABLE: user_competency_scores
-- =============================================================================
CREATE TABLE public.user_competency_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competency_id   uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  score           numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  last_assessed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, competency_id)
);

COMMENT ON TABLE public.user_competency_scores IS
  'Current competency score per user. One row per user per competency.';

-- =============================================================================
-- TABLE: survey_questions
-- =============================================================================
CREATE TABLE public.survey_questions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id     uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  question_text     text NOT NULL,
  description       text,
  designation_scope text,
  department_scope  uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.survey_questions IS
  'Self-assessment survey questions. Each linked to a competency and optionally scoped to designations/departments.';

-- =============================================================================
-- TABLE: survey_responses
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
  'Individual survey answers. Multiple responses per user per question allowed (tracks history).';

-- =============================================================================
-- TABLE: courses
-- =============================================================================
CREATE TABLE public.courses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title              text NOT NULL,
  description        text,
  source             course_source NOT NULL DEFAULT 'internal',
  external_id        text,
  external_url       text,
  duration_hours     numeric CHECK (duration_hours > 0),
  content_chunks_ref text,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

COMMENT ON TABLE public.courses IS
  'Course metadata. Sources: igot, internal, nssta_tpac. Each course links to competencies it addresses.';

-- =============================================================================
-- TABLE: course_competencies
-- =============================================================================
CREATE TABLE public.course_competencies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  competency_id  uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, competency_id)
);

COMMENT ON TABLE public.course_competencies IS
  'Many-to-many join: which competencies each course addresses.';

-- =============================================================================
-- TABLE: enrollments
-- =============================================================================
CREATE TABLE public.enrollments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id        uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status           enrollment_status NOT NULL DEFAULT 'not_started',
  progress_percent numeric CHECK (progress_percent >= 0 AND progress_percent <= 100) DEFAULT 0,
  enrolled_at      timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

COMMENT ON TABLE public.enrollments IS
  'Per-user course enrollment and progress. Tracks status (not_started/in_progress/completed).';

-- =============================================================================
-- TABLE: assessments
-- =============================================================================
CREATE TABLE public.assessments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id          uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title              text NOT NULL,
  description        text,
  pass_threshold     numeric NOT NULL DEFAULT 60 CHECK (pass_threshold > 0 AND pass_threshold <= 100),
  time_limit_minutes integer CHECK (time_limit_minutes > 0),
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessments IS
  'Assessment definitions linked to courses. Each has a pass threshold and optional time limit.';

-- =============================================================================
-- TABLE: assessment_questions
-- =============================================================================
CREATE TABLE public.assessment_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  competency_id  uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  question_text  text NOT NULL,
  options        jsonb NOT NULL,
  correct_answer text NOT NULL,
  difficulty     difficulty_level NOT NULL DEFAULT 'intermediate',
  points         integer NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_questions IS
  'Individual assessment questions. Tagged with competency and difficulty for weak-area analysis.';

-- =============================================================================
-- TABLE: assessment_attempts
-- =============================================================================
CREATE TABLE public.assessment_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  score         numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  passed        boolean NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_attempts IS
  'Per-user assessment attempt records. INSERT-ONLY for authenticated users — prevents tampering.';

-- =============================================================================
-- TABLE: assessment_answers
-- =============================================================================
CREATE TABLE public.assessment_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      uuid NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  selected_answer text NOT NULL,
  correct         boolean NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

COMMENT ON TABLE public.assessment_answers IS
  'Individual question answers within an attempt. INSERT-ONLY — powers weak-area analysis.';

-- =============================================================================
-- TABLE: certificates
-- =============================================================================
CREATE TABLE public.certificates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  verification_code text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  verification_hash text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

COMMENT ON TABLE public.certificates IS
  'Issued course completion certificates. Each has a unique verification code.';

-- =============================================================================
-- TABLE: indian_states
-- =============================================================================
CREATE TABLE public.indian_states (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  code       text NOT NULL UNIQUE,
  is_ut      boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.indian_states IS
  'All 36 Indian states and union territories for profile setup dropdowns.';

-- =============================================================================
-- TABLE: central_ministries
-- =============================================================================
CREATE TABLE public.central_ministries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  short_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.central_ministries IS
  'Central government ministries and departments for profile setup dropdown.';

-- =============================================================================
-- TABLE: organisations
-- =============================================================================
CREATE TABLE public.organisations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  ministry   text,
  state      text,
  org_type   text CHECK (org_type IN ('central', 'state', 'autonomous', 'psu')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organisations IS
  'Government organisations, bodies, and units for profile setup.';

-- =============================================================================
-- TABLE: designations
-- =============================================================================
CREATE TABLE public.designations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  level      text CHECK (level IN ('entry', 'mid', 'senior', 'executive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.designations IS
  'Job designations/titles for profile setup dropdown.';
