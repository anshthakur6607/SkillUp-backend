/**
 * Supabase client initialization.
 *
 * This file creates two Supabase client instances:
 *
 * 1. `supabaseAnon` — uses the public/anonymous API key.
 *    This client respects Row Level Security (RLS) policies, which means
 *    database access is automatically restricted based on who is making
 *    the request. This is the client you should use for most operations.
 *
 * 2. `supabaseServiceRole` — uses the service role key.
 *    ⚠️  DANGER: This key BYPASSES all Row Level Security policies.
 *    It should ONLY be used for trusted server-side operations that need
 *    to access data regardless of who the requesting user is (e.g.
 *    admin operations, background jobs).
 *    NEVER expose this key to the frontend.
 *    NEVER log this key.
 *    NEVER include it in error messages.
 *
 * NOTE: The Database generic type is omitted for now because Supabase v2's
 * type inference requires a specific structure that we'll generate via the
 * Supabase CLI in a later step. For now, queries are untyped at the
 * Supabase client level but validated by our controller logic (field
 * allow-lists, RLS policies, etc.).
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * The "normal" Supabase client — respects RLS.
 * Use this for all routine data access where the requesting user's identity
 * should determine what they can see and do.
 */
export const supabaseAnon = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY
);

/**
 * The "service role" Supabase client — BYPASSES RLS.
 *
 * ⚠️  SECURITY WARNING ⚠️
 * This client has unrestricted access to ALL data in the database,
 * regardless of any RLS policies. It is equivalent to a database
 * administrator account.
 *
 * Rules:
 * - Only use this in server-side code that runs in a trusted context
 *   (e.g. background jobs, admin endpoints behind auth)
 * - Never pass this client to frontend code
 * - Never log the service role key value
 * - If this key leaks, regenerate it immediately in the Supabase dashboard
 */
export const supabaseServiceRole = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      // The service role key doesn't need to manage user sessions,
      // since it's used for server-side trusted operations only.
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
