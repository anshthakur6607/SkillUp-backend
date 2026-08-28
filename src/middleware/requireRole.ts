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
 * Uses Redis caching with a SHORT TTL (60 seconds) for role lookups.
 * Short TTL balances performance with freshness — if a user is demoted,
 * the cache will expire within a minute. Acceptable tradeoff for most apps.
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseServiceRole } from '../config/supabaseClient';
import { AppError } from './errorHandler';
import { cacheGetOrSet } from '../config/redis';

// Cache roles for 60 seconds — short enough that role changes take effect quickly,
// long enough to eliminate repeated DB hits for the same user.
const ROLE_CACHE_TTL = 60;

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
        return next(new AppError('Authentication required', 401));
      }

      const cacheKey = `role:${req.user.id}`;

      const userRole = await cacheGetOrSet<string>(
        cacheKey,
        ROLE_CACHE_TTL,
        async () => {
          const { data, error } = await supabaseServiceRole
            .from('profiles')
            .select('role')
            .eq('id', req.user!.id)
            .single();

          if (error || !data) return null;
          return (data as { role: string }).role;
        },
      );

      if (!userRole) {
        return next(new AppError('Access denied', 403));
      }

      if (!allowedRoles.includes(userRole)) {
        return next(new AppError('Access denied', 403));
      }

      next();
    } catch {
      return next(new AppError('Access denied', 403));
    }
  };
}
