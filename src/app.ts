/**
 * Express application setup.
 *
 * This file wires together all middleware and routes into the Express app.
 * The ORDER of middleware matters! Express processes middleware in the order
 * it's registered, so:
 *
 *   1. Security headers (helmet) — set these FIRST so they're on every response
 *   2. CORS — check the origin BEFORE processing the request body
 *   3. Rate limiting — reject excessive requests BEFORE parsing/sanitizing input
 *   4. Body parsing — parse the request body so we can work with it
 *   5. Input sanitization — clean the input AFTER parsing but BEFORE routes
 *   6. Routes — the actual business logic runs on already-validated input
 *   7. 404 handler — catch any routes that weren't matched
 *   8. Error handler — catch any errors thrown by the above
 *
 * This ordering ensures security checks happen as early as possible,
 * minimizing the server's attack surface.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/sanitize';
import { AppError, errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health';

// Importing supabaseClient ensures it initializes at startup.
// If the Supabase URL or keys are invalid, we'll catch it early.
import './config/supabaseClient';

const app = express();

// ─── 1. SECURITY HEADERS ────────────────────────────────────────────────────
// Helmet sets a variety of HTTP headers that protect against common attacks:
// - Clickjacking (X-Frame-Options): prevents your site from being embedded in
//   malicious iframes that trick users into clicking things.
// - MIME sniffing (X-Content-Type-Options): stops browsers from guessing the
//   content type of a response, which could be exploited to run uploaded files
//   as scripts.
// - XSS (X-XSS-Protection, Content-Security-Policy): adds browser-level XSS
//   filtering and restricts which resources can be loaded.
app.use(helmet());

// ─── 2. CORS (CROSS-ORIGIN RESOURCE SHARING) ───────────────────────────────
// CORS controls which websites are allowed to make requests to this API.
// Without CORS, the browser would block requests from other origins (e.g.
// your React frontend on localhost:3000 calling this API on localhost:5000).
//
// Why NOT use wildcard (*) CORS?
// A wildcard allows ANY website to make requests to your API. If your API
// handles authentication (cookies, tokens), a malicious website could make
// authenticated requests on behalf of your users — this is a serious security
// vulnerability. By specifying exact allowed origins, only trusted domains
// can interact with the API.
const allowedOrigins = env.ALLOWED_ORIGINS
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true, // Allow cookies/auth headers to be sent with requests
}));

// ─── 3. RATE LIMITING ───────────────────────────────────────────────────────
// Applies the global rate limiter (configured in src/middleware/rateLimiter.ts).
// This runs BEFORE body parsing and route handling, so even invalid/malicious
// requests consume rate limit tokens — preventing abuse even when requests
// fail.
app.use(globalRateLimiter);

// ─── 4. BODY PARSING ────────────────────────────────────────────────────────
// Parses incoming JSON request bodies into JavaScript objects.
// The size limit (10kb) prevents attackers from sending enormous payloads
// that consume excessive server memory (a "payload DoS" attack).
app.use(express.json({ limit: '10kb' }));

// ─── 5. HTTP PARAMETER POLLUTION PROTECTION ────────────────────────────────
// HPP protects against HTTP Parameter Pollution (HPP), where an attacker
// sends the same query parameter multiple times with different values
// (e.g. ?role=admin&role=user). Without HPP, the server might receive
// an array instead of a single value, potentially bypassing security checks.
app.use(hpp());

// ─── 6. INPUT SANITIZATION ──────────────────────────────────────────────────
// Sanitize all incoming string values in body, query, and params against
// XSS (Cross-Site Scripting) payloads. This runs AFTER body parsing (so
// we have parsed data to work with) but BEFORE routes (so cleaned data
// reaches the business logic).
app.use(sanitizeInput);

// ─── 7. ROUTES ──────────────────────────────────────────────────────────────
// Mount route modules. Each route file handles a specific part of the API.
// All routes are prefixed with /api for a clean, versioned URL structure.
app.use('/api', healthRoutes);

// ─── 8. 404 HANDLER ─────────────────────────────────────────────────────────
// If no route matched the request, this middleware runs.
// It creates an AppError with 404 status and passes it to the error handler.
// We use next() to forward the error rather than sending a response directly,
// so the centralized error handler formats it consistently.
app.use((_req, _res, next) => {
  next(new AppError('Route not found', 404));
});

// ─── 9. CENTRALIZED ERROR HANDLER ───────────────────────────────────────────
// This MUST be the last middleware registered. Express identifies error
// handlers by their 4-parameter signature (err, req, res, next). If this
// were placed before routes, it wouldn't catch route errors.
app.use(errorHandler);

export default app;
