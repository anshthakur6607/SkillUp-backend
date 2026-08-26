/**
 * Input sanitization middleware.
 *
 * What is XSS and why do we sanitize?
 * Cross-Site Scripting (XSS) is an attack where someone submits malicious
 * JavaScript code hidden inside form fields, query parameters, or URL paths.
 * If this code is later displayed to other users without cleaning it first,
 * the attacker's script runs in the victim's browser — potentially stealing
 * cookies, session tokens, or personal data.
 *
 * There are two main types:
 * - Reflected XSS: the malicious script is in the URL or a form field and
 *   gets "reflected" back in the server's response immediately.
 * - Stored XSS: the malicious script is saved in the database and served to
 *   other users later (more dangerous because it persists).
 *
 * This middleware sanitizes ALL incoming string values in request bodies,
 * query parameters, and URL parameters by stripping HTML/script tags.
 * It's a defense-in-depth measure — we should also sanitize on output,
 * but catching it at the input stage prevents a whole class of attacks.
 */

import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * Recursively sanitize all string values in a nested object/array.
 * This walks through the entire request data structure and cleans
 * any string it finds, no matter how deeply nested.
 */
function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return xss(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  // Numbers, booleans, null, and undefined pass through unchanged.
  return obj;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 * This runs on every request before it reaches route handlers.
 *
 * The sanitization is applied to all three sources because attackers
 * can inject malicious content through any of them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  // Express's req.query type (ParsedQs) doesn't directly match our sanitized
  // output type. We cast through `any` because the sanitized object preserves
  // the same structure with cleaned string values — this is a safe cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (req.query && typeof req.query === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req.query = sanitizeObject(req.query) as any;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as Record<string, string>;
  }
  next();
}
