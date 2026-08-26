/**
 * Defines the shape of JSON responses returned by our API endpoints.
 *
 * Having explicit response types ensures consistency across all endpoints —
 * every health check response, error response, etc. follows the same structure.
 * It also lets us catch mistakes at compile time (e.g. forgetting to include
 * the 'status' field).
 */

/**
 * The response body for GET /api/health.
 * This is intentionally simple — it just confirms the server is alive.
 */
export interface HealthCheckResponse {
  /** "ok" when healthy, "error" when something is wrong */
  status: 'ok' | 'error';

  /** ISO 8601 timestamp of when the health check was performed */
  timestamp: string;
}
