/**
 * verifyAuth middleware — validates Supabase-issued Bearer tokens.
 *
 * Reads the Authorization header, extracts the token, and verifies it
 * against Supabase Auth using the ANON client (not service role).
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

/**
 * Middleware: verifyAuth
 *
 * Checks for a valid Bearer token in the Authorization header.
 * On success, populates req.user with { id, email }.
 * On failure, responds with 401.
 */
export async function verifyAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Generic message — don't reveal whether the header was missing or malformed
      return next(new AppError('Invalid or missing authentication', 401));
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next(new AppError('Invalid or missing authentication', 401));
    }

    // Verify the token against Supabase Auth using the anon client.
    // This calls Supabase's JWT verification endpoint — it checks:
    // 1. The token is properly signed by Supabase
    // 2. The token hasn't expired
    // 3. The user still exists in auth.users
    const { data, error } = await supabaseAnon.auth.getUser(token);

    if (error || !data.user) {
      // Generic message — don't distinguish between expired, malformed, or non-existent user
      return next(new AppError('Invalid or missing authentication', 401));
    }

    // Attach verified user info to the request for downstream middleware/routes
    req.user = {
      id: data.user.id,
      email: data.user.email ?? '',
    };

    next();
  } catch {
    // Catch any unexpected errors (network issues, Supabase downtime, etc.)
    // Don't leak internal details — just return a generic auth error
    return next(new AppError('Invalid or missing authentication', 401));
  }
}
