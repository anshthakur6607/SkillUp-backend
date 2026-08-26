/**
 * Rate limiting middleware.
 *
 * What is rate limiting and why do we need it?
 * Rate limiting restricts how many requests a single IP address can make
 * within a given time window. Without it, someone could flood the server
 * with thousands of requests per second (a "denial of service" or "brute
 * force" attack), overwhelming the server and making it unavailable for
 * legitimate users.
 *
 * Think of it like a bouncer at a door: "You can come in, but only 100
 * times in the next 15 minutes. After that, wait outside for a while."
 *
 * These limits are configurable via environment variables so different
 * deployments (development vs production) can have different thresholds.
 */

import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * A global rate limiter applied to ALL routes.
 *
 * Configuration is read from environment variables:
 * - RATE_LIMIT_WINDOW_MS: the time window in milliseconds (default 15 minutes)
 * - RATE_LIMIT_MAX_REQUESTS: max requests allowed in that window (default 100)
 *
 * When the limit is exceeded, the client receives a 429 "Too Many Requests"
 * response. This protects against:
 * - Brute force attacks (trying many passwords rapidly)
 * - Denial of service (flooding the server with traffic)
 * - Abuse of expensive operations (e.g. complex queries, AI calls)
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  // Use a standard response format that clients can understand
  standardHeaders: true,
  // Disable the legacy X-RateLimit headers in favor of the standard
  // RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  // Return a clear JSON error message when the limit is hit
  message: {
    status: 'error',
    message: 'Too many requests. Please wait a moment and try again.',
  },
});
