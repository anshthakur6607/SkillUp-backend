/**
 * requireRole middleware factory — checks if the authenticated user has
 * one of the allowed roles.
 *
 * IMPORTANT: This middleware MUST be applied AFTER verifyAuth, because it
 * depends on req.user being populated with the authenticated user's ID.
 *
 * Uses the SERVICE ROLE client for role lookup — here's why this is correct:
 * - verifyAuth (above) already confirmed the token is valid — the user is authenticated
 * - Now we need to check their role in the profiles table
 * - The service role client is appropriate here because:
 *   (a) We're performing a trusted server-side authorization check, not a user-facing data read
 *   (b) Using the anon client would require an RLS policy allowing the user to read their own role,
 *       which adds complexity without security benefit — the RLS policy for profiles already allows
 *       users to read their own row, but using service role here is cleaner for a pure auth check
 *   (c) The service role client bypasses RLS, which is fine because we're only reading the role
 *       column for a user we've already verified owns this token
 *
 * Why no caching?
 * - Caching roles in memory risks stale data: if a user is demoted from admin to employee,
 *   the cache would still say "admin" until it expires, letting them retain elevated access
 * - At this stage, the performance cost of a DB lookup per request is negligible
 * - If performance becomes a concern later, we can add Redis caching with short TTLs,
 *   but the security tradeoff must be explicitly documented
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseServiceRole } from '../config/supabaseClient';
import { AppError } from './errorHandler';

/**
 * Creates middleware that checks if req.user has one of the allowed roles.
 *
 * @param allowedRoles - list of role values that are permitted (e.g. ['admin', 'manager'])
 *
 * Usage:
 *   router.get('/admin-only', verifyAuth, requireRole('admin'), handler);
 *   router.get('/management', verifyAuth, requireRole('admin', 'manager'), handler);
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) {
        // This shouldn't happen if verifyAuth ran first, but be defensive
        return next(new AppError('Authentication required', 401));
      }

      // Look up the user's role from the profiles table using the service role client.
      // We select only the `role` column — minimal data exposure even with service role.
      const { data, error } = await supabaseServiceRole
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

      if (error || !data) {
        // Profile doesn't exist — this could happen if the signup trigger hasn't run yet,
        // or if the user's profile was deleted. Treat as unauthorized.
        return next(new AppError('Access denied', 403));
      }

      // Type-safe role access
      const userRole = (data as { role: string }).role;

      if (!allowedRoles.includes(userRole)) {
        return next(new AppError('Access denied', 403));
      }

      next();
    } catch {
      // Don't leak internal details on unexpected errors
      return next(new AppError('Access denied', 403));
    }
  };
}
