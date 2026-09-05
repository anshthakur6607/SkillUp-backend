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
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { env } from './config/env';

import app from './app';

const httpServer = http.createServer(app);

const liveTutorSocketServer = new WebSocketServer({
  noServer: true,
  path: '/ws/live-tutor',
});

httpServer.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (requestUrl.pathname !== '/ws/live-tutor') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  const token = requestUrl.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  liveTutorSocketServer.handleUpgrade(request, socket, head, (ws) => {
    liveTutorSocketServer.emit('connection', ws, request);
  });
});

liveTutorSocketServer.on('connection', (ws, request) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const token = requestUrl.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Missing token');
    return;
  }

  ws.send(JSON.stringify({
    type: 'connected',
    service: 'live-tutor',
    ok: true,
    message: 'Live tutoring socket connected',
  }));

  ws.on('message', (message) => {
    const payload = message.toString();

    ws.send(JSON.stringify({
      type: 'echo',
      data: payload,
    }));
  });

  ws.on('close', () => {
    console.log('Live tutor socket closed');
  });
});

/**
 * Start the server.
 *
 * We use async/await for consistency, even though the current listen() call
 * is synchronous. When we later add database connection checks or other
 * async startup logic, this structure will already be in place.
 */
const startServer = async (): Promise<void> => {
  try {
    httpServer.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`   Health check: http://localhost:${env.PORT}/api/health`);
      console.log(`   WebSocket: ws://localhost:${env.PORT}/ws/live-tutor?token=YOUR_TOKEN`);
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
