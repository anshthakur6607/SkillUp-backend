/**
 * Centralized error handling middleware.
 *
 * In Express, error handling middleware has a special signature: it takes
 * four parameters (err, req, res, next). Express recognizes this signature
 * and calls it whenever `next(err)` is called or an error is thrown in
 * an async route handler.
 *
 * Why centralize error handling?
 * Without it, every route would need its own try/catch blocks, and if a
 * developer forgets one, the error crashes the whole server. With a
 * centralized handler, ALL errors funnel to this one place, where we can
 * log them properly and return a consistent response format.
 *
 * IMPORTANT: We never leak internal details (stack traces, database errors,
 * file paths, etc.) to the client in production. This prevents attackers
 * from learning about our internal architecture. In development mode,
 * we include more detail to help with debugging.
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * A custom application error class.
 * When we need to throw an error that should result in a specific HTTP status code
 * (like 404 Not Found or 400 Bad Request), we create an instance of this class
 * with the appropriate status code. The error handler will read this status code
 * and use it in the response.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    // "Operational" errors are expected/normal (e.g. "user not found").
    // "Programmer" errors are bugs (e.g. "cannot read property of undefined").
    // We handle them differently in the error handler below.
    this.isOperational = true;
    // Fix TypeScript prototype chain for `instanceof` checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * The centralized error handler middleware.
 *
 * This is the last middleware in the chain — it only runs when an error
 * has occurred somewhere upstream.
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine the status code: use the custom error's code, or default to 500
  // (Internal Server Error) for unexpected/programmer errors.
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isProduction = env.NODE_ENV === 'production';

  // Always log the full error server-side so we can debug issues.
  // In production, we log to stdout; in development, we also see it in the terminal.
  console.error(`[Error] ${statusCode} — ${err.message}`);
  if (!isProduction && err.stack) {
    console.error(err.stack);
  }

  // Send the response to the client.
  // In production, we only send a generic message — never the stack trace
  // or internal error details that could help an attacker understand our system.
  // In development, we include the error message to help with debugging.
  res.status(statusCode).json({
    status: 'error',
    message: isProduction && statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
  });
}
