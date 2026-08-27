/**
 * Upstash Redis client.
 *
 * Uses Upstash's REST-based Redis SDK, which works over HTTP (no TCP sockets).
 * This is ideal for serverless environments like Vercel, Cloudflare Workers, etc.
 *
 * Falls back gracefully if UPSTASH_REDIS_REST_URL/TOKEN are not set,
 * so development without Redis still works (just without caching).
 */

import { Redis } from '@upstash/redis';
import { env } from './env';

/**
 * The Redis client instance.
 * If Upstash credentials are not configured, this is null and all
 * cache operations become no-ops.
 */
export const redis: Redis | null =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Helper: get a cached value or compute + cache it.
 * Returns null (and doesn't cache) if the compute function returns null/undefined.
 *
 * @param key - Redis cache key
 * @param ttlSeconds - Time-to-live in seconds
 * @param compute - Async function that returns the value to cache
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T | null>,
): Promise<T | null> {
  if (!redis) return compute();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) return cached;
  } catch {
    // Redis unavailable — fall through to compute
  }

  const value = await compute();
  if (value !== null && value !== undefined) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch {
      // Redis write failed — not critical, just no caching
    }
  }
  return value;
}

/**
 * Helper: delete one or more keys from the cache.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch {
    // Not critical
  }
}

/**
 * Helper: set a value in the cache with a TTL.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Not critical
  }
}
