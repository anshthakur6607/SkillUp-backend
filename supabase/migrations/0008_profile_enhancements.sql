-- =============================================================================
-- Migration 0008: Add professional profile fields for hackathon demo
--
-- These fields are needed for:
-- 1. Personalized competency recommendations (education + experience = career stage)
-- 2. Job role mapping (different roles need different skills)
-- 3. Department sub-selection under ministry (iGOT-style granular org structure)
-- 4. Language preference (foundation for future Bhashini multilingual support)
--
-- The competency preview in setup-profile shows users what skills will be
-- assessed, building trust with government evaluators.
-- =============================================================================

-- Add professional profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_role text,
  ADD COLUMN IF NOT EXISTS education_level text CHECK (education_level IN (
    'high_school', 'diploma', 'bachelors', 'bachelors_engineering',
    'masters', 'masters_engineering', 'phd', 'professional', 'other'
  )),
  ADD COLUMN IF NOT EXISTS years_of_experience integer CHECK (years_of_experience >= 0 AND years_of_experience <= 60),
  ADD COLUMN IF NOT EXISTS department_name text,
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ur'));

COMMENT ON COLUMN public.profiles.job_role IS
  'Specific job role within the designation (e.g. Field Surveyor, Data Analyst, Section Head). More granular than designation.';
COMMENT ON COLUMN public.profiles.education_level IS
  'Highest education level. Used for career-stage personalization in competency recommendations.';
COMMENT ON COLUMN public.profiles.years_of_experience IS
  'Total years of government service. Helps calibrate skill gap expectations (junior vs senior).';
COMMENT ON COLUMN public.profiles.department_name IS
  'Sub-department or division within the ministry/organisation (e.g. NSSO Field Operations Division).';
COMMENT ON COLUMN public.profiles.preferred_language IS
  'Preferred language for UI and content. Foundation for Bhashini multilingual integration.';

-- =============================================================================
-- DEPARTMENTS table — sub-departments under ministries
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.departments_lookup (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  ministry   text,
  state      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments_lookup IS
  'Sub-departments and divisions within ministries/states. Used in setup-profile dropdown.';

-- Enable RLS
ALTER TABLE public.departments_lookup ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read, admins can manage
CREATE POLICY "dept_lookup_select_auth" ON public.departments_lookup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dept_lookup_insert_admin" ON public.departments_lookup
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "dept_lookup_update_admin" ON public.departments_lookup
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "dept_lookup_delete_admin" ON public.departments_lookup
  FOR DELETE TO authenticated USING (is_admin());

COMMENT ON TABLE public.departments_lookup IS
  'Sub-departments under ministries. Readable by all authenticated users. Managed by admins.';
