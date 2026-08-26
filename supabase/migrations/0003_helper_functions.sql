-- =============================================================================
-- Migration: 0003_helper_functions.sql
-- Purpose:   Create reusable SQL helper functions used by RLS policies
--            and triggers.
--
--            WHY REUSABLE FUNCTIONS?
--            If every RLS policy duplicates the role-lookup logic inline
--            (e.g. "SELECT role FROM profiles WHERE id = auth.uid()"),
--            a mistake in one policy — say, a typo that accidentally
--            grants access — would create a security hole that's hard
--            to spot because it's scattered across dozens of policies.
--
--            By centralizing the logic in named functions:
--            1. We write and audit the role-check logic ONCE
--            2. Every policy that calls is_admin() gets identical behavior
--            3. Fixing a bug in one place fixes it everywhere
--            4. The function name reads like English in the policy,
--               making the intent clear: "WHERE is_admin() OR id = auth.uid()"
--
--            This migration runs AFTER 0002_core_tables.sql, so the
--            profiles table exists and these functions can reference it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: is_admin()
-- Purpose:  Returns true if the currently authenticated user has the 'admin'
--           role in the profiles table.
-- Used by:  Many RLS policies to grant admin-only access (e.g. insert/update
--           on reference tables, viewing all profiles).
-- Security: Reads from profiles using auth.uid(), so it respects RLS on the
--           profiles table itself. Only works for authenticated users.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Function: is_manager_of(target_user_id uuid)
-- Purpose:  Returns true if the currently authenticated user is a manager
--           AND the target user is in the same department.
-- Used by:  Manager-level RLS policies where managers can view (but not edit)
--           employee data within their department only.
-- Security: Checks both role AND department_id to ensure managers can only
--           access their own department's data, never other departments.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_manager_of(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS manager
    JOIN public.profiles AS target
      ON manager.department_id = target.department_id
    WHERE manager.id = auth.uid()
      AND manager.role = 'manager'
      AND target.id = target_user_id
  );
$$;

-- -----------------------------------------------------------------------------
-- Function: set_updated_at()
-- Purpose:  Trigger function that automatically sets the updated_at column
--           to the current timestamp whenever a row is modified.
-- Used by:  Attached to every table that has an updated_at column.
-- Why:      Prevents forgetting to set updated_at in application code.
--           The database handles it automatically, so no row can be updated
--           without its timestamp being refreshed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
