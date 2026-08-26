-- =============================================================================
-- Migration: 0003_core_identity.sql
-- Purpose:   Create the core identity tables: departments and profiles.
--
--            These are the foundation tables that every other table references.
--            profiles is linked to Supabase Auth's auth.users table — each
--            authenticated user gets exactly one profile row.
-- =============================================================================

-- =============================================================================
-- TABLE: departments
-- =============================================================================
-- Lookup table for government departments/organisations. Profiles reference
-- this via department_id so we have consistent, normalized department names
-- instead of free-text strings that could vary ("MoSPI" vs "MOSPI" vs
-- "Ministry of Statistics").
-- =============================================================================
CREATE TABLE public.departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  code        text UNIQUE,             -- short code like "MOSPI", "NSSTA"
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments IS
  'Lookup table of government departments. Normalised to prevent inconsistent naming.';

COMMENT ON COLUMN public.departments.name IS
  'Full department name, e.g. "Ministry of Statistics and Programme Implementation"';

COMMENT ON COLUMN public.departments.code IS
  'Short department code, e.g. "MOSPI", "NSSTA" — optional but useful for display.';

-- =============================================================================
-- TABLE: profiles
-- =============================================================================
-- One row per authenticated user. This is the central identity table that
-- connects Supabase Auth (auth.users) to our application data.
--
-- The id column references auth.users(id) directly — we do NOT store
-- passwords or auth tokens here; Supabase Auth handles that.
--
-- The role column determines what a user can see and do throughout the system:
--   - employee: can only see their own data
--   - manager:  can see aggregated (not individual) data for their department
--   - admin:    full access to everything
-- =============================================================================
CREATE TABLE public.profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          text NOT NULL,
  email              text UNIQUE,        -- for display; auth is via auth.users
  designation        text,               -- job title e.g. "Senior Statistical Officer"
  department_id      uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  job_role           text,               -- specific role within department
  education          text,               -- highest qualification
  years_of_experience integer CHECK (years_of_experience >= 0),
  role               user_role NOT NULL DEFAULT 'employee',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'One row per authenticated user. Links to auth.users for identity. The role column controls RLS access throughout the entire system.';

COMMENT ON COLUMN public.profiles.id IS
  'References auth.users(id) — the Supabase Auth user. ON DELETE CASCADE means if the auth user is deleted, their profile goes too.';

COMMENT ON COLUMN public.profiles.role IS
  'Determines system-wide access level. employee = own data only. manager = aggregated department data. admin = full access.';

COMMENT ON COLUMN public.profiles.department_id IS
  'FK to departments. SET NULL on delete preserves the profile if a department is removed (audit trail).';

-- Auto-update updated_at on any profile change
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS: departments
-- =============================================================================
-- Reference/catalogue data: any authenticated user can read departments
-- (they need to see department names in the UI), but only admins can
-- create, edit, or delete them.
-- Anonymous (unauthenticated) access is explicitly blocked — even though
-- department names aren't secret, blocking anon access is a defence-in-depth
-- measure that prevents unauthenticated scraping or enumeration.
-- =============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "departments_select_authenticated" ON public.departments IS
  'Authenticated users can view departments (needed for UI dropdowns). Anonymous access is blocked.';

CREATE POLICY "departments_select_authenticated"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "departments_insert_admin" ON public.departments IS
  'Only admins can create new departments.';

CREATE POLICY "departments_insert_admin"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "departments_update_admin" ON public.departments IS
  'Only admins can modify department details.';

CREATE POLICY "departments_update_admin"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "departments_delete_admin" ON public.departments IS
  'Only admins can delete departments. Consider using soft-delete instead to preserve audit trails.';

CREATE POLICY "departments_delete_admin"
  ON public.departments FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: profiles
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own profile (id = auth.uid())
--     - Admins can see all profiles
--     - Managers can see profiles in their own department only
--   INSERT:
--     - Only via service role (server-side, tied to Supabase Auth signup).
--       No authenticated user should INSERT profiles directly — the server
--       creates the profile when a new user signs up.
--   UPDATE:
--     - Users can update their own profile (limited fields)
--     - Admins can update any profile (e.g. change roles)
--   DELETE:
--     - Only admins can delete profiles (account deactivation)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS
  'Users can always see their own profile.';

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

COMMENT ON POLICY "profiles_select_admin" ON public.profiles IS
  'Admins can see all profiles — needed for user management dashboards.';

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "profiles_select_manager_department" ON public.profiles IS
  'Managers can see profiles in their own department only — never other departments.';

CREATE POLICY "profiles_select_manager_department"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS manager
      WHERE manager.id = auth.uid()
        AND manager.role = 'manager'
        AND manager.department_id = profiles.department_id
    )
  );

-- No INSERT policy for authenticated users — profile creation happens
-- via service role (server-side signup flow). If an authenticated user
-- tries to INSERT a profile, RLS blocks it by default.

COMMENT ON POLICY "profiles_update_own" ON public.profiles IS
  'Users can update their own profile (name, education, etc.).';

CREATE POLI
