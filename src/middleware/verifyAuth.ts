/**
 * verifyAuth middleware — validates Supabase-issued Bearer tokens.
 *
 * Reads the Authorization header, extracts the token, and verifies it
 * against Supabase Auth using the ANON client (not service role).
 *
 * Uses Redis caching to avoid verifying the same token against Supabase
 * on every request. Cached entries expire after 5 minutes.
 *
 * Why the anon client for verification?
 * - Token verification is a read-only check against Supabase Auth's JWT endpoint
 * - It does NOT need to bypass RLS or access restricted data
 * - Using the anon client is the correct pattern: it validates the token
 *   without granting any elevated database privileges
 * - The service role client is only for trusted server-side operations
 *   that need to bypass RLS (see requireRole.ts for an example)
 *
 * If valid, attaches the verified user to req.user for downstream use.
 */

import { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../config/supabaseClient';
import { AppError } from './errorHandler';
import { cacheGetOrSet } from '../config/redis';

// Extend Express Request to include the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

// Cache validated user info for 5 minutes to avoid hitting Supabase
// on every single request. If a user is deleted or banned, the cache
// will expire and the next request will fail at Supabase verification.
const SESSION_CACHE_TTL = 300; // 5 minutes

/**
 * Middleware: verifyAuth
 *
 * Checks for a valid Bearer token in the Authorization header.
 * On success, populates req.user with { id, email }.
 * On failure, responds with 401.
 *
 * Uses Redis caching to avoid verifying the same token against Supabase
 * on every request. Cached entries expire after SESSION_CACHE_TTL seconds.
 */
export async function verifyAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Invalid or missing authentication', 401));
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next(new AppError('Invalid or missing authentication', 401));
    }

    // Use first 32 chars of token as cache key (avoids storing full token)
    const tokenPrefix = token.substring(0, 32);
    const cacheKey = `session:${tokenPrefix}`;

    const cached = await cacheGetOrSet<{ id: string; email: string }>(
      cacheKey,
      SESSION_CACHE_TTL,
      async () => {
        const { data, error } = await supabaseAnon.auth.getUser(token);

        if (error || !data.user) {
          return null;
        }

        return {
          id: data.user.id,
          email: data.user.email ?? '',
        };
      },
    );

    if (!cached) {
      return next(new AppError('Invalid or missing authentication', 401));
    }

    req.user = cached;
    next();
  } catch {
    return next(new AppError('Invalid or missing authentication', 401));
  }
}
