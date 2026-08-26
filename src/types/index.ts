/**
 * Central export for all shared TypeScript types.
 *
 * This barrel file lets other files import types from a single place
 * (e.g. import { HealthCheckResponse, EnvConfig } from '../types')
 * instead of reaching into individual files.
 */

export type { Database } from './database';
export type { HealthCheckResponse } from './responses';

/**
 * Shape of the validated environment configuration object.
 * This is inferred from the Zod schema in src/config/env.ts,
 * so it stays in sync automatically — if we add or remove an
 * environment variable from the schema, this type updates too.
 */
export type { EnvConfig } from '../config/env';
