-- =============================================================================
-- Migration 0011: Add profile setup fields to profiles table
-- =============================================================================
-- After signup, users go through a profile setup flow (like iGOT Karmayogi).
-- These fields capture their government affiliation details.
-- =============================================================================

-- Enum for Center/State classification
DO $$ BEGIN
  CREATE TYPE public.government_level AS ENUM ('center', 'state');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS government_level public.government_level,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS ministry text,
  ADD COLUMN IF NOT EXISTS organisation text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS profile_complete boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.government_level IS
  'Whether the user works at Center (central government) or State (state government). Determines which dropdowns appear during profile setup.';

COMMENT ON COLUMN public.profiles.state IS
  'State name for state government employees. NULL for central government employees.';

COMMENT ON COLUMN public.profiles.ministry IS
  'Ministry/Department name for central government employees. NULL for state government employees.';

COMMENT ON COLUMN public.profiles.organisation IS
  'Specific organisation/unit within the ministry or state department.';

COMMENT ON COLUMN public.profiles.profile_complete IS
  'Whether the user has completed the profile setup flow. False after signup, set to true after completing /setup-profile.';
