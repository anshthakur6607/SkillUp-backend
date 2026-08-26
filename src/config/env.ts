/**
 * Environment variable loader and validator.
 *
 * This is the single place where ALL environment variables are loaded and
 * validated. Every other file in the project imports `env` from here instead
 * of reading process.env directly.
 *
 * Why validate at startup?
 * If we forget to set a required variable (like SUPABASE_URL), the server
 * would crash later with a confusing error deep in some request handler.
 * By validating upfront and failing fast, we get a clear, immediate error
 * message telling us exactly which variable is missing.
 */

// Load the .env file into process.env BEFORE we validate anything.
// dotenv reads the .env file and sets each variable as a process.env property.
// This must happen before Zod validation, otherwise the variables won't exist.
//
// We use { override: true } so that values from the .env file take precedence
// over any pre-existing environment variables. This is important because some
// hosting environments or terminals set variables like PORT that we want to
// override with our .env values.
import { config as loadDotenv } from 'dotenv';
loadDotenv({ override: true });

import { z } from 'zod';

/**
 * Define the schema for all required and optional environment variables.
 * Zod validates the values AND infers the TypeScript type from this schema,
 * so the type and the runtime validation always stay in sync.
 */
const envSchema = z.object({
  // The runtime environment: "development" for local work, "production" for deployed servers.
  // Controls things like whether stack traces are shown in error responses.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // The port the HTTP server will listen on. We parse it to a number because
  // environment variables are always strings, but we need a number for the port.
  PORT: z.coerce.number().default(5000),

  // Supabase connection details — these are required for the app to talk to the database.
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL (e.g. https://xyz.supabase.co)' }),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // CORS: which frontend origins are allowed to call this API.
  // Parsed into an array because multiple origins may be comma-separated.
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Rate limiting configuration — controls how many requests each IP can make
  // within a time window before being temporarily blocked.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

/**
 * Validate process.env against the schema.
 * If any required variable is missing or has an invalid value, Zod throws
 * a descriptive error message immediately — the server will not start.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid or missing environment variables:');
  // Zod gives us a structured error — format it so developers can see
  // exactly which variables are wrong and why.
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  }
  // Crash immediately rather than running in an insecure/incomplete state.
  process.exit(1);
}

/**
 * The validated, type-safe configuration object.
 * Every file in the project should import this instead of process.env.
 * TypeScript knows the exact shape and types of all properties.
 */
export const env = parsed.data;

/**
 * The TypeScript type inferred from the Zod schema.
 * Other files can import this type when they need to type a config parameter.
 */
export type EnvConfig = z.infer<typeof envSchema>;
