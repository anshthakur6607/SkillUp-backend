-- =============================================================================
-- Migration 0011: Gamification System (idempotent)
-- =============================================================================
-- Safe to re-run: drops existing policies/tables before creating.
--
-- Adds:
--   1. user_xp — tracks experience points and level per user
--   2. user_badges — earned badges per user
--   3. user_activity_log — recent learning activity for streak calculation
-- =============================================================================

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "user_xp_own_select" ON public.user_xp;
DROP POLICY IF EXISTS "user_xp_own_insert" ON public.user_xp;
DROP POLICY IF EXISTS "user_xp_own_update" ON public.user_xp;
DROP POLICY IF EXISTS "user_xp_admin_delete" ON public.user_xp;
DROP POLICY IF EXISTS "user_badges_own_select" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_admin_insert" ON public.user_badges;
DROP POLICY IF EXISTS "user_activity_own_select" ON public.user_activity_log;
DROP POLICY IF EXISTS "user_activity_admin_insert" ON public.user_activity_log;

-- Drop existing triggers
DROP TRIGGER IF EXISTS user_xp_updated_at ON public.user_xp;
DROP FUNCTION IF EXISTS public.handle_user_xp_updated_at();

-- TABLE: user_xp
CREATE TABLE IF NOT EXISTS public.user_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_xp UNIQUE (user_id)
);

COMMENT ON TABLE public.user_xp IS
  'Gamification XP and level tracking. One row per user.';

ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_xp_own_select" ON public.user_xp
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_xp_own_insert" ON public.user_xp
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_xp_own_update" ON public.user_xp
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_xp_admin_delete" ON public.user_xp
  FOR DELETE USING (false);

-- TABLE: user_badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_category TEXT NOT NULL DEFAULT 'special',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id)
);

COMMENT ON TABLE public.user_badges IS
  'Earned badges per user. Each badge is earned once and timestamped.';

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_own_select" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_badges_admin_insert" ON public.user_badges
  FOR INSERT WITH CHECK (false);

-- TABLE: user_activity_log
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT,
  xp_earned INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_activity_log IS
  'Learning activity log per user. Used for streak calculation and gamification feed.';

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_activity_own_select" ON public.user_activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_activity_admin_insert" ON public.user_activity_log
  FOR INSERT WITH CHECK (false);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_xp_user ON public.user_xp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_streak ON public.user_xp(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON public.user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON public.user_activity_log(user_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_user_xp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER user_xp_updated_at
  BEFORE UPDATE ON public.user_xp
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_xp_updated_at();
