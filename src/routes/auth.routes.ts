/**
 * Auth routes — GET /api/auth/me, PATCH /api/auth/profile,
 * POST /api/auth/resend-verification, GET /api/auth/profile-status,
 * POST /api/auth/setup-profile.
 *
 * All routes are protected by verifyAuth (token validation).
 * The update route uses a stricter rate limit because auth-adjacent
 * endpoints are common targets for enumeration/abuse.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyAuth } from '../middleware/verifyAuth';
import { getMe, updateProfile } from '../controllers/authController';
import {
  resendVerification,
  getProfileStatus,
  setupProfile,
} from '../controllers/authSignupController';

const router = Router();

// =============================================================================
// Stricter rate limiter for auth routes
// =============================================================================
// Separate from the global rate limiter. Auth endpoints are
// targeted more aggressively by bots and scanners, so they get a lower limit.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes per IP
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

/**
 * POST /api/auth/resend-verification
 * Resends the email verification link. Rate limited by Upstash (3 per 10 min per email).
 * Does NOT require a valid session — the user may not be verified yet.
 */
router.post('/auth/resend-verification', resendVerification);

/**
 * GET /api/auth/profile-status
 * Returns whether the authenticated user has completed their profile setup.
 * Used by the frontend after login to decide redirect (setup-profile vs dashboard).
 */
router.get('/auth/profile-status', authRateLimiter, verifyAuth, getProfileStatus);

/**
 * POST /api/auth/setup-profile
 * Server-side profile setup with validation.
 * Protected by verifyAuth.
 */
router.post('/auth/setup-profile', authRateLimiter, verifyAuth, setupProfile);

export default router;
