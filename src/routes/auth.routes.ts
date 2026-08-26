/**
 * Auth routes — GET /api/auth/me and PATCH /api/auth/profile.
 *
 * Both routes are protected by verifyAuth (token validation).
 * The update route uses a stricter rate limit because auth-adjacent
 * endpoints are common targets for enumeration/abuse.
 *
 * Why stricter rate limits on auth routes?
 * - Attackers often probe auth endpoints to enumerate valid accounts
 * - Profile updates can be abused to test injection payloads
 * - Supabase Auth itself rate-limits signup/login, but our backend
 *   endpoints are separate and need their own protection
 * - 20 requests per 15 minutes is generous for legitimate use but
 *   blocks automated abuse
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyAuth } from '../middleware/verifyAuth';
import { getMe, updateProfile } from '../controllers/authController';

const router = Router();

// =============================================================================
// Stricter rate limiter for auth routes
// =============================================================================
// Separate from the global rate limiter in Step 1. Auth endpoints are
// targeted more aggressively by bots and scanners, so they get a lower limit.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests to auth endpoints. Please wait and try again.',
  },
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/auth/me
 * Returns the authenticated user's identity + full profile.
 * Protected by verifyAuth — requires a valid Bearer token.
 */
router.get('/auth/me', authRateLimiter, verifyAuth, getMe);

/**
 * PATCH /api/auth/profile
 * Updates the user's own profile (limited field allow-list).
 * Protected by verifyAuth — the user can only update their own row.
 */
router.patch('/auth/profile', authRateLimiter, verifyAuth, updateProfile);

export default router;
