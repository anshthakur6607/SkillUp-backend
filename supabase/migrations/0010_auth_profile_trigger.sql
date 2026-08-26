-- =============================================================================
-- Migration 0010: Auto-create profile on Supabase Auth signup
-- =============================================================================
-- When a new user signs up through Supabase Auth (email/password, Google OAuth,
-- or any other provider), a corresponding row is automatically created in the
-- `profiles` table. This ensures every authenticated user always has a profile,
-- and the app never needs to manually insert into profiles.
--
-- SECURITY: The `role` column is HARDCODED to 'employee' in this trigger.
-- We never read it from user-supplied metadata (raw_user_meta_data), because
-- anyone can craft arbitrary metadata during signup. If we read `role` from
-- metadata, a malicious user could set role = 'admin' in their signup request
-- and gain elevated privileges. By hardcoding it here, the role can ONLY be
-- changed later by an admin through a trusted server-side endpoint.
-- =============================================================================

-- Reusable function: set updated_at timestamp on profile changes
-- (The 0002 migration already creates this, but we ensure it exists.)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Trigger function: handle_new_user()
-- =============================================================================
-- Runs AFTER a new row is inserted into auth.users (Supabase's internal
-- authentication table). Pulls basic profile info from the user's metadata
-- (which OAuth providers populate, e.g. Google returns `full_name`, `avatar_url`)
-- and creates a matching row in public.profiles.
--
-- What metadata is available?
-- - Email/password signups: raw_user_meta_data usually has just `email`
-- - Google OAuth: raw_user_meta_data includes `full_name`, `avatar_url`, `email`
-- - Other providers vary, but typically include `name` or `full_name`
--
-- We handle all cases with sensible fallbacks.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
BEGIN
  -- Extract email (always available from auth.users)
  v_email := COALESCE(NEW.email, '');

  -- Extract full_name from metadata, with fallbacks for different providers
  -- Google uses "full_name", some providers use "name", email signups may have neither
  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)  -- fallback: use email prefix as name
  );

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    v_full_name,
    v_email,
    'employee'::user_role  -- HARDCODED: never read from user metadata!
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Trigger: fire handle_new_user after each new auth.users row
-- =============================================================================
-- SECURITY DEFINER means this function runs with the privileges of the role
-- that created it (usually the database owner), not the role of the calling
-- user. This is necessary because auth.users is in the `auth` schema, which
-- regular users cannot write to — but we need to read from it (NEW record)
-- and write to public.profiles.
-- =============================================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Trigger function: handle_user_update()
-- =============================================================================
-- Syncs changes from auth.users back to profiles when a user updates their
-- email or metadata in Supabase Auth (e.g. through the account settings page
-- or an admin action). Keeps profiles in sync without requiring app-level code.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    full_name = COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      profiles.full_name  -- keep existing if metadata doesn't change
    ),
    email = COALESCE(NEW.email, profiles.email),
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Trigger: fire handle_user_update after auth.users changes
-- =============================================================================
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- =============================================================================
-- Comments: document what these triggers do for future maintainers
-- =============================================================================
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a profiles row when a new user signs up via Supabase Auth. '
  'Role is hardcoded to employee — never read from user metadata to prevent privilege escalation.';

COMMENT ON FUNCTION public.handle_user_update() IS
  'Syncs email and full_name changes from auth.users back to profiles. '
  'Keeps the profiles table in sync when users update their account info.';

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Fires after a new user signs up. Creates a matching row in public.profiles.';

COMMENT ON TRIGGER on_auth_user_updated ON auth.users IS
  'Fires when auth.users metadata changes. Syncs profile fields.';
