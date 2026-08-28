/**
 * Integration Layer — shared types for platform adapters.
 *
 * This is the generic interface that all platform adapters implement.
 * The adapter pattern makes it easy to add new platforms (DIKSHA, SWAYAM, etc.)
 * without changing the sync service or controllers.
 */

export type PlatformType = 'igot' | 'nssta_tpac' | 'diksha' | 'swayam' | 'ehrms' | 'sparrow' | 'internal';
export type SyncDirection = 'inbound' | 'outbound' | 'webhook';
export type SyncStatus = 'pending' | 'success' | 'failed' | 'partial';

/** Generic course shape returned by any platform adapter. */
export interface ExternalCourse {
  externalId: string;
  title: string;
  description?: string;
  url?: string;
  durationHours?: number;
  competencies: string[];
  source: PlatformType;
}

/** Generic enrollment record from any platform. */
export interface ExternalEnrollment {
  userId: string;
  platform: PlatformType;
  externalCourseId: string;
  courseTitle?: string;
  status: string;
  enrolledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  progressPercent?: number;
}

/** Generic completion record from any platform. */
export interface ExternalCompletion {
  userId: string;
  platform: PlatformType;
  externalCourseId: string;
  courseTitle?: string;
  completedAt: Date;
  score?: number;
  certificateId?: string;
}

/** NSSTA TPAC training session. */
export interface TPACSession {
  externalId?: string;
  title: string;
  description?: string;
  trainingType: 'classroom' | 'online' | 'hybrid' | 'field';
  startDate: Date;
  endDate?: Date;
  location?: string;
  capacity?: number;
  competencies: string[];
  targetDesignations: string[];
  sourceUrl?: string;
}

/** Webhook payload from an external platform. */
export interface WebhookPayload {
  platform: PlatformType;
  event: string;
  userId?: string;
  courseId?: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

/** Sync log entry. */
export interface SyncLogEntry {
  platform: PlatformType;
  direction: SyncDirection;
  eventType: string;
  status: SyncStatus;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  recordsAffected?: number;
}
