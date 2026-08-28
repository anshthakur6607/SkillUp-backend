-- =============================================================================
-- Migration 0009: Platform Integration Layer
--
-- Supports two-way sync with iGOT Karmayogi, NSSTA TPAC, and future platforms
-- (DIKSHA, SWAYAM, e-HRMS/SPARROW).
--
-- Architecture:
--   platform_configs    — per-platform connection settings (API URLs, keys, etc.)
--   integration_logs    — audit trail of every sync event (pull/push/webhook)
--   platform_enrollments — tracks user enrollments on external platforms
--   platform_completions — tracks course completions synced from external platforms
-- =============================================================================

-- Enum for platform types
DO $$ BEGIN
  CREATE TYPE public.platform_type AS ENUM ('igot', 'nssta_tpac', 'diksha', 'swayam', 'ehrms', 'sparrow', 'internal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for sync direction
DO $$ BEGIN
  CREATE TYPE public.sync_direction AS ENUM ('inbound', 'outbound', 'webhook');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enum for sync status
DO $$ BEGIN
  CREATE TYPE public.sync_status AS ENUM ('pending', 'success', 'failed', 'partial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- TABLE: platform_configs
-- Configuration for each external platform connection.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.platform_configs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      platform_type NOT NULL UNIQUE,
  display_name  text NOT NULL,
  api_base_url  text,
  webhook_secret text,
  is_active     boolean NOT NULL DEFAULT true,
  sync_interval_minutes integer DEFAULT 60,
  last_synced_at timestamptz,
  config        jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_configs IS
  'External platform connection configs. One row per platform (iGOT, NSSTA TPAC, etc).';
COMMENT ON COLUMN public.platform_configs.config IS
  'Flexible JSON config for platform-specific settings (API keys, field mappings, etc).';

-- =============================================================================
-- TABLE: integration_logs
-- Audit trail of every sync event.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      platform_type NOT NULL,
  direction     sync_direction NOT NULL,
  event_type    text NOT NULL,
  status        sync_status NOT NULL DEFAULT 'pending',
  payload       jsonb,
  error_message text,
  records_affected integer DEFAULT 0,
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

COMMENT ON TABLE public.integration_logs IS
  'Immutable audit trail of every sync event. Used for debugging, monitoring, and compliance.';

-- =============================================================================
-- TABLE: platform_enrollments
-- Tracks user enrollments on external platforms (iGOT courses, TPAC sessions).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.platform_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform        platform_type NOT NULL,
  external_course_id text NOT NULL,
  external_enrollment_id text,
  course_title    text,
  status          text NOT NULL DEFAULT 'enrolled',
  enrolled_at     timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  progress_percent numeric CHECK (progress_percent >= 0 AND progress_percent <= 100) DEFAULT 0,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, external_course_id)
);

COMMENT ON TABLE public.platform_enrollments IS
  'External platform enrollments synced from iGOT/TPAC. Enables two-way visibility.';

-- =============================================================================
-- TABLE: platform_completions
-- Records of completed courses from external platforms.
-- These trigger competency score updates in our system.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.platform_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform        platform_type NOT NULL,
  external_course_id text NOT NULL,
  course_title    text,
  completed_at    timestamptz NOT NULL,
  score           numeric,
  certificate_id  text,
  competency_updates jsonb DEFAULT '[]',
  processed       boolean NOT NULL DEFAULT false,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, external_course_id)
);

COMMENT ON TABLE public.platform_completions IS
  'External course completions. When processed=true, competency scores are updated.';

-- =============================================================================
-- TABLE: nssta_tpac_sessions
-- NSSTA Training Planning and Coordination calendar entries.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.nssta_tpac_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     text UNIQUE,
  title           text NOT NULL,
  description     text,
  training_type   text CHECK (training_type IN ('classroom', 'online', 'hybrid', 'field')),
  start_date      date NOT NULL,
  end_date        date,
  location        text,
  capacity        integer,
  enrolled_count  integer DEFAULT 0,
  competencies    text[] DEFAULT '{}',
  target_designations text[] DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  source_url      text,
  synced_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nssta_tpac_sessions IS
  'NSSTA TPAC training calendar. Synced from nssta.gov.in or entered manually.';

-- Enable RLS on all integration tables
ALTER TABLE public.platform_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nssta_tpac_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies: admins manage, authenticated users read
CREATE POLICY "platform_configs_admin" ON public.platform_configs
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "integration_logs_admin" ON public.integration_logs
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "platform_enrollments_select_auth" ON public.platform_enrollments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "platform_enrollments_insert_admin" ON public.platform_enrollments
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "platform_completions_select_auth" ON public.platform_completions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "platform_completions_insert_admin" ON public.platform_completions
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "tpac_sessions_select_auth" ON public.nssta_tpac_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tpac_sessions_manage_admin" ON public.nssta_tpac_sessions
  FOR ALL TO authenticated USING (is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_logs_platform ON public.integration_logs(platform);
CREATE INDEX IF NOT EXISTS idx_integration_logs_started ON public.integration_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_enrollments_user ON public.platform_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_enrollments_platform ON public.platform_enrollments(platform);
CREATE INDEX IF NOT EXISTS idx_platform_completions_user ON public.platform_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_completions_processed ON public.platform_completions(processed);
CREATE INDEX IF NOT EXISTS idx_tpac_sessions_dates ON public.nssta_tpac_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tpac_sessions_active ON public.nssta_tpac_sessions(is_active) WHERE is_active = true;
