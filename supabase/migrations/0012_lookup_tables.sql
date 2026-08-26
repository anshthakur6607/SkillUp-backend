-- =============================================================================
-- Migration 0012: Lookup tables for profile setup dropdowns
-- =============================================================================
-- Static reference data for the profile setup wizard.
-- These are government of India reference lists.
-- =============================================================================

-- Indian States and Union Territories
CREATE TABLE IF NOT EXISTS public.indian_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  is_ut boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.indian_states IS 'All 36 Indian states and union territories for profile setup dropdowns.';

-- Central Government Ministries/Departments
CREATE TABLE IF NOT EXISTS public.central_ministries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.central_ministries IS 'Central government ministries and departments for profile setup dropdown.';

-- Organisations (sample - can be expanded)
CREATE TABLE IF NOT EXISTS public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ministry text,
  state text,
  org_type text CHECK (org_type IN ('central', 'state', 'autonomous', 'psu')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organisations IS 'Government organisations, bodies, and units for profile setup.';

-- Designations
CREATE TABLE IF NOT EXISTS public.designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  level text CHECK (level IN ('entry', 'mid', 'senior', 'executive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.designations IS 'Job designations/titles for profile setup dropdown.';

-- RLS: Allow any authenticated user to read lookup data
ALTER TABLE public.indian_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read states" ON public.indian_states
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read ministries" ON public.central_ministries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read organisations" ON public.organisations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read designations" ON public.designations
  FOR SELECT TO authenticated USING (true);

-- Admins can manage lookup data
CREATE POLICY "Admins can manage states" ON public.indian_states
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage ministries" ON public.central_ministries
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage organisations" ON public.organisations
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage designations" ON public.designations
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organisations_ministry ON public.organisations(ministry);
CREATE INDEX IF NOT EXISTS idx_organisations_state ON public.organisations(state);
CREATE INDEX IF NOT EXISTS idx_organisations_type ON public.organisations(org_type);
