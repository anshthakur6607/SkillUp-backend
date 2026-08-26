-- =============================================================================
-- Migration 0006: Auto-create profile on Supabase Auth signup
-- =============================================================================
-- PART 1: Create the trigger functions (runs in SQL Editor — no issues)
-- PART 2: Attach triggers to auth.users (requires Dashboard — see below)
--
-- WHY THE SPLIT?
-- auth.users is owned by supabase_auth_admin. The SQL Editor runs as postgres,
-- which cannot CREATE TRIGGER on auth.users. This is a Supabase platform
-- restriction. The functions themselves are fine to create here.
--
-- AFTER RUNNING THIS MIGRATION, go to:
--   Supabase Dashboard → Database → Webhooks
--   OR use the Supabase CLI: supabase db push
-- =============================================================================

-- =============================================================================
-- PART 1: Trigger functions (safe to run in SQL Editor)
-- =============================================================================

-- handle_new_user(): Creates a profiles row when a new user signs up.
-- SECURITY: role is HARDCODED to 'employee' — never read from user metadata.
-- This prevents privilege escalation via crafted signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
BEGIN
  v_email := COALESCE(NEW.email, '');

  v_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    v_full_name,
    v_email,
    'employee'::user_role  -- HARDCODED: never from user metadata!
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- handle_user_update(): Syncs auth.users changes back to profiles.
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    full_name = COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      profiles.full_name
    ),
    email = COALESCE(NEW.email, profiles.email),
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates a profiles row when a new user signs up. Role hardcoded to employee.';

COMMENT ON FUNCTION public.handle_user_update() IS
  'Syncs email and full_name from auth.users back to profiles.';

-- =============================================================================
-- PART 2: Attach triggers to auth.users
-- =============================================================================
-- IMPORTANT: These two statements will FAIL in the Supabase SQL Editor
-- because auth.users is owned by supabase_auth_admin, not postgres.
--
-- TO FIX THIS, choose ONE of these options:
--
-- OPTION A (Recommended): Supabase Dashboard
--   1. Go to https://supabase.com/dashboard/project/[your-project]/database/webhooks
--   2. Create a webhook:
--      - Table: auth.users
--      - Events: INSERT
--      - Type: PostgreSQL function
--      - Function: handle_new_user
--   3. Create another webhook:
--      - Table: auth.users
--      - Events: UPDATE
--      - Type: PostgreSQL function
--      - Function: handle_user_update
--
-- OPTION B: Supabase CLI (if installed)
--   Run: supabase db push
--   This runs migrations with the correct supabase_admin role.
--
-- OPTION C: Ask Supabase support to run these two statements:
--   CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--
--   CREATE TRIGGER on_auth_user_updated
--     AFTER UPDATE ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
--
-- The functions above are already created. You just need to ATTACH them
-- as triggers on auth.users using one of the methods above.
-- =============================================================================
