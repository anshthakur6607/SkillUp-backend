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

import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '../config/redis';
import { env } from '../config/env';
import { Request, Response, NextFunction } from 'express';

// =============================================================================
// Upstash Ratelimit (distributed, Redis-backed)
// =============================================================================
// If Redis is configured, we use Upstash's Ratelimit which stores counters
// in Redis — works across multiple server instances (serverless, multi-region).
// Falls back to a simple in-memory counter when Redis is not configured.

const upstashRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        env.RATE_LIMIT_MAX_REQUESTS,
        `${env.RATE_LIMIT_WINDOW_MS / 1000} s`,
      ),
      analytics: true,
      prefix: 'ratelimit:global',
    })
  : null;

// =============================================================================
// In-memory fallback (single instance only)
// =============================================================================
const memoryCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Global rate limiter middleware.
 *
 * Uses Upstash Ratelimit when Redis is available (distributed, accurate).
 * Falls back to in-memory sliding window when Redis is not configured.
 */
export async function globalRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ip = getClientIp(req);

  // --- Upstash path ---
  if (upstashRatelimit) {
    try {
      const result = await upstashRatelimit.limit(ip);
      res.setHeader('RateLimit-Limit', result.limit);
      res.setHeader('RateLimit-Remaining', result.remaining);
      res.setHeader('RateLimit-Reset', result.reset);

      if (!result.success) {
        res.status(429).json({
          status: 'error',
          message: 'Too many requests. Please wait and try again.',
        });
        return;
      }
      return next();
    } catch {
      // Redis failure — don't block the request, just skip rate limiting
      return next();
    }
  }

  // --- In-memory fallback ---
  const now = Date.now();
  const entry = memoryCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    memoryCounts.set(ip, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
    return next();
  }
  entry.count++;
  if (entry.count > env.RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests. Please wait and try again.',
    });
    return;
  }
  return next();
}
