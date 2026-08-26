/**
 * Auth controller — handles GET /api/auth/me and PATCH /api/auth/profile.
 *
 * These are thin controllers that delegate to Supabase. The frontend handles
 * actual login/signup via the Supabase client SDK directly — these endpoints
 * are for the backend to verify sessions and update profile data after auth.
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../config/supabaseClient';
import { AppError } from '../middleware/errorHandler';

// =============================================================================
// GET /api/auth/me
// =============================================================================
/**
 * Returns the authenticated user's identity + full profile.
 *
 * Uses the ANON client so it naturally respects RLS — the user reading
 * their own profile is already allowed by the Step 2 RLS policy. This
 * doubles as a live RLS sanity check: if RLS were misconfigured, this
 * query might fail or return unexpected data.
 *
 * The frontend calls this right after login to:
 * 1. Confirm the session token is valid (if the backend accepts it)
 * 2. Get the full profile data for the UI (name, role, department, etc.)
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    const { data: profile, error } = await supabaseAnon
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return next(new AppError('Profile not found', 404));
    }

    res.json({
      status: 'ok',
      data: {
        id: userId,
        email: req.user!.email,
        profile,
      },
    });
  } catch {
    next(new AppError('Failed to fetch profile', 500));
  }
}

// =============================================================================
// PATCH /api/auth/profile
// =============================================================================
/**
 * Updates a limited set of the user's own profile fields.
 *
 * SECURITY: Only an explicit allow-list of fields can be updated.
 * We ignore any extra fields in the request body — this is more robust
 * than trying to reject unexpected fields, because:
 * 1. It's impossible to accidentally allow a sensitive field through
 * 2. We never need to maintain a "blocked fields" list
 * 3. Adding a new allowed field requires an intentional code change
 *
 * The `role` field is NEVER in the allow-list — it can only be changed
 * by an admin through a dedicated endpoint (future step).
 *
 * Uses the ANON client so RLS enforces "own row only" as a second
 * layer of defense, not just the allow-list in this code.
 */

// Fields that users are allowed to update on their own profile
const ALLOWED_FIELDS = ['full_name', 'designation', 'department_id', 'job_role', 'education', 'years_of_experience'] as const;

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;

    // Build the update object from only the allowed fields.
    // Extra fields in the request body are silently ignored.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};

    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) {
        const value = req.body[field];
        if (typeof value === 'string') {
          updates[field] = value.trim() || null;
        } else if (typeof value === 'number') {
          updates[field] = value;
        } else if (value === null || value === undefined) {
          updates[field] = null;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return next(new AppError('No valid fields to update', 400));
    }

    // Update using the anon client — RLS enforces "own row only"
    const { data, error } = await supabaseAnon
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return next(new AppError('Failed to update profile', 500));
    }

    res.json({
      status: 'ok',
      data: { profile: data },
    });
  } catch {
    next(new AppError('Failed to update profile', 500));
  }
}
