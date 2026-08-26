/**
 * Server entry point.
 *
 * This is the file that actually starts the HTTP server.
 * It imports the Express app (which has all middleware and routes wired up)
 * and tells it to listen on a specific port.
 *
 * We separate app.ts (the Express configuration) from server.ts (the
 * startup code) so that:
 *   1. We can import the app in tests without starting the server.
 *   2. The startup logic stays clean and focused.
 */

// Load and validate environment variables FIRST — before anything else
// imports them. This ensures we fail fast if required variables are missing.
// The env.ts module will crash the process with a clear error message
// if any required variable is missing.
import { env } from './config/env';

import app from './app';

/**
 * Start the server.
 *
 * We use async/await for consistency, even though the current listen() call
 * is synchronous. When we later add database connection checks or other
 * async startup logic, this structure will already be in place.
 */
const startServer = async (): Promise<void> => {
  try {
    app.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`   Health check: http://localhost:${env.PORT}/api/health`);
    });
  } catch (error) {
    // If the server fails to start (e.g. port already in use), log the error
    // and exit with a non-zero status code so process managers (PM2, Docker)
    // know the process failed and can restart it.
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
