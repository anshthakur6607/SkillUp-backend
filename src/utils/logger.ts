/**
 * Utility logging helpers.
 *
 * This file will grow as the project evolves. For now, it provides
 * a thin wrapper around console methods so we can later swap in a
 * proper logging library (e.g. winston, pino) without changing
 * every file that logs.
 *
 * Keeping logging in one place means we can:
 * - Add timestamps and log levels to all messages at once
 * - Switch between console output and file/external logging
 * - Suppress logs in tests easily
 */

/**
 * Log an informational message (normal operation).
 * Use for things like "Server started", "User logged in", etc.
 */
export const logInfo = (message: string): void => {
  console.log(`[INFO] ${new Date().toISOString()} — ${message}`);
};

/**
 * Log an error message (something went wrong).
 * The full error details are logged server-side only; they should
 * never reach the client through this function.
 */
export const logError = (message: string, error?: Error): void => {
  console.error(`[ERROR] ${new Date().toISOString()} — ${message}`);
  if (error?.stack) {
    console.error(error.stack);
  }
};
