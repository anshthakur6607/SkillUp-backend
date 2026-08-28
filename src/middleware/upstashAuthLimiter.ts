/**
 * Upstash rate limiter for auth-specific endpoints.
 *
 * Separate from the global rate limiter — auth endpoints need stricter
 * limits because they're common targets for brute force and enumeration.
 *
 * 5 requests per 10 minutes per key (email or IP).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../config/redis';

/**
 * Auth rate limiter — 5 requests per 10 minutes.
 * Works across server instances when Redis is configured.
 * Falls back to always-allow when Redis is not available.
 */
export const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '600 s'),
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : // Fallback: always allow (no Redis)
    {
      limit: async (_key: string) => ({
        success: true,
        limit: 5,
        remaining: 5,
        reset: Date.now() + 600_000,
      }),
    };
