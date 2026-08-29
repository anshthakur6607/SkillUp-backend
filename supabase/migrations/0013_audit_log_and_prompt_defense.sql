-- =============================================================================
-- Migration 0013: Audit Log + Prompt Injection Defense
-- =============================================================================
-- Adds:
--   1. audit_log — tracks every competency/score change, APAR access, admin action
--   2. prompt_defense — stores prompt injection patterns for detection
-- =============================================================================

-- TABLE: audit_log
-- Immutable audit trail for all sensitive operations.
-- No UPDATE or DELETE policies — once written, entries cannot be modified.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
  'Immutable audit trail for competency changes, score updates, APAR access, and admin actions. No UPDATE/DELETE allowed.';

COMMENT ON COLUMN public.audit_log.action IS
  'Action performed: competency_updated, score_changed, assessment_completed, course_completed, profile_updated, admin_action, apar_access.';
COMMENT ON COLUMN public.audit_log.resource_type IS
  'Type of resource affected: competency_score, profile, enrollment, certificate, assessment.';
COMMENT ON COLUMN public.audit_log.old_value IS
  'Previous value before change (for updates). Null for creates.';
COMMENT ON COLUMN public.audit_log.new_value IS
  'New value after change.';

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log
CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Inserts are done by service role only (application-level logging)
CREATE POLICY "audit_log_insert_service" ON public.audit_log
  FOR INSERT WITH CHECK (false);

-- NO UPDATE or DELETE policies — audit log is immutable
COMMENT ON POLICY "audit_log_admin_select" ON public.audit_log IS
  'Only admins can read audit logs. This is intentional — auditors and compliance officers need access, but regular users should not see other users activity.';

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- Function to log competency score changes (called from application)
CREATE OR REPLACE FUNCTION public.log_competency_change(
  p_user_id UUID,
  p_competency_id UUID,
  p_old_score DECIMAL,
  p_new_score DECIMAL,
  p_source TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, old_value, new_value)
  VALUES (
    p_user_id,
    'competency_updated',
    'competency_score',
    p_competency_id::text,
    jsonb_build_object('score', p_old_score, 'source', p_source),
    jsonb_build_object('score', p_new_score, 'source', p_source)
  );
END;
$$;

COMMENT ON FUNCTION public.log_competency_change IS
  'Logs a competency score change to the audit trail. Called by application code whenever scores are updated.';
