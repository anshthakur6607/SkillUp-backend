/**
 * Auth signup controller — handles server-side signup operations.
 *
 * The actual Supabase auth.signUp() happens on the frontend via the JS SDK.
 * These endpoints handle:
 * 1. Resending verification emails (with Upstash rate limiting)
 * 2. Checking if a user's profile is complete (post-signup redirect logic)
 * 3. Creating/updating the user's profile after email confirmation
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseServiceRole, supabaseAnon } from '../config/supabaseClient';
import { AppError } from '../middleware/errorHandler';
import { cacheGetOrSet } from '../config/redis';
import { ratelimit } from '../middleware/upstashAuthLimiter';
import { cacheDel } from '../config/redis.js';

// =============================================================================
// POST /api/auth/resend-verification
// =============================================================================
/**
 * Resends the email verification link.
 * Uses Upstash rate limiting to prevent abuse (max 3 per 10 minutes per email).
 * Uses the service role client to call Supabase's admin API to resend the email.
 */
export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return next(new AppError('Email is required', 400));
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Rate limit: 3 resend attempts per email per 10 minutes
    const rlKey = `resend:${trimmedEmail}`;
    const { success } = await ratelimit.limit(rlKey);

    if (!success) {
      res.status(429).json({
        status: 'error',
        message: 'Too many verification emails sent. Please wait 10 minutes before trying again.',
      });
      return;
    }

    // Look up the user by email using the admin API
    const { data: userData, error: lookupError } =
      await supabaseServiceRole.auth.admin.listUsers();

    if (lookupError || !userData?.users?.length) {
      // Don't reveal whether the email exists — generic success response
      res.json({
        status: 'ok',
        message: 'If that email is registered, a verification link has been sent.',
      });
      return;
    }

    // Find the user by email from the list
    const user = userData.users.find((u) => u.email === trimmedEmail);

    if (!user) {
      // Don't reveal whether the email exists
      res.json({
        status: 'ok',
        message: 'If that email is registered, a verification link has been sent.',
      });
      return;
    }

    // If already confirmed, no need to resend
    if (user.email_confirmed_at) {
      res.json({
        status: 'ok',
        message: 'If that email is registered, a verification link has been sent.',
      });
      return;
    }

    // Generate a new magic link for the user (this sends an email)
    const { error: linkError } = await supabaseServiceRole.auth.admin.generateLink({
      type: 'magiclink',
      email: trimmedEmail,
    });

    if (linkError) {
      console.error('[Auth] Failed to generate verification link:', linkError.message);
    }

    // Always return success — don't reveal whether the email exists
    res.json({
      status: 'ok',
      message: 'If that email is registered, a verification link has been sent.',
    });
  } catch {
    next(new AppError('Failed to resend verification email', 500));
  }
}

// =============================================================================
// GET /api/auth/profile-status
// =============================================================================
/**
 * Check if the authenticated user has completed their profile setup.
 * Returns { profileComplete: boolean, profile: object | null }
 * Used by the frontend after login to decide where to redirect.
 */
export async function getProfileStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const cacheKey = `profile-status:${userId}`;

    const profile = await cacheGetOrSet<{
      profile_complete: boolean;
      full_name: string;
      role: string;
    }>(
      cacheKey,
      120, // Cache for 2 minutes
      async () => {
        const { data, error } = await supabaseAnon
          .from('profiles')
          .select('profile_complete, full_name, role')
          .eq('id', userId)
          .single();

        if (error || !data) return null;
        return data as { profile_complete: boolean; full_name: string; role: string };
      },
    );

    if (!profile) {
      res.json({
        status: 'ok',
        data: { profileComplete: false, profile: null },
      });
      return;
    }

    res.json({
      status: 'ok',
      data: {
        profileComplete: profile.profile_complete ?? false,
        profile,
      },
    });
  } catch {
    next(new AppError('Failed to check profile status', 500));
  }
}

// =============================================================================
// POST /api/auth/setup-profile
// =============================================================================
/**
 * Server-side profile setup. Creates or updates the profile with
 * government-level info (ministry, state, org, designation).
 * This is the server-side equivalent of the client-side Supabase update
 * but goes through our API for validation and caching.
 */
export async function setupProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { government_level, ministry, state, organisation, designation, phone } = req.body;

    // Validate required fields
    if (!government_level || !organisation || !designation) {
      return next(new AppError('government_level, organisation, and designation are required', 400));
    }

    if (!['center', 'state'].includes(government_level)) {
      return next(new AppError('government_level must be "center" or "state"', 400));
    }

    const updates: Record<string, unknown> = {
      designation,
      organisation: organisation || null,
      job_role: designation,
      profile_complete: true,
    };

    if (government_level === 'center' && ministry) {
      updates.department_id = null; // Will be resolved by the frontend
    }

    if (government_level === 'state' && state) {
      updates.department_id = null; // Will be resolved by the frontend
    }

    if (phone) {
      updates.education = phone; // Store phone in education field for now
    }

    const { data, error } = await supabaseAnon
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return next(new AppError('Failed to update profile', 500));
    }

    // Invalidate profile cache
    await cacheDel(`profile-status:${userId}`, `role:${userId}`);

    res.json({
      status: 'ok',
      data: { profile: data },
    });
  } catch {
    next(new AppError('Failed to setup profile', 500));
  }
}
