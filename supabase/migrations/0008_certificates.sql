-- =============================================================================
-- Migration: 0008_certificates.sql
-- Purpose:   Create the certificates table for issued course certificates.
--
--            Certificates are issued when a user completes a course and
--            passes the associated assessment. Each certificate has a
--            verification code that can be used to verify its authenticity.
-- =============================================================================

-- =============================================================================
-- TABLE: certificates
-- =============================================================================
-- Issued certificate records. Each certificate links a user to a course
-- they've completed successfully.
--
-- The verification_code is a unique, random string that can be shared
-- publicly for verification (e.g. on a LinkedIn profile or resume).
-- Anyone with the code can verify the certificate is real without needing
-- an account — this is handled by a future public verification endpoint.
--
-- The verification_hash is a SHA-256 hash of the certificate details,
-- providing an additional layer of tamper detection.
-- =============================================================================
CREATE TABLE public.certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  verification_code   text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  verification_hash   text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- One certificate per user per course (no duplicate certifications)
  UNIQUE (user_id, course_id)
);

COMMENT ON TABLE public.certificates IS
  'Issued course completion certificates. Each has a unique verification code for public authenticity checks.';

COMMENT ON COLUMN public.certificates.verification_code IS
  'Unique 32-character hex string for public certificate verification. Generated randomly at creation.';

COMMENT ON COLUMN public.certificates.verification_hash IS
  'SHA-256 hash of certificate details (user, course, date). Provides tamper detection.';

COMMENT ON COLUMN public.certificates.issued_at IS
  'When the certificate was issued. Usually matches course completion date.';

-- =============================================================================
-- RLS: certificates
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own certificates (user_id = auth.uid())
--     - Admins can see all certificates
--     - Managers can see certificates for users in their department
--       (to track team certifications)
--     - Public verification is handled by a separate endpoint using
--       the verification_code, NOT through RLS. The verification endpoint
--       uses the service role (bypasses RLS) to look up certificates
--       by verification_code.
--   INSERT:
--     - No INSERT policy for authenticated users = blocked by default.
--       Certificates are issued exclusively by the server (service role)
--       after a user completes a course and passes the assessment.
--   UPDATE/DELETE:
--     - No policies = blocked by default. Certificates are permanent
--       records that should never be modified or deleted by users.
-- =============================================================================
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "certificates_select_own" ON public.certificates IS
  'Users can see their own certificates — needed for "My Certificates" view.';

CREATE POLICY "certificates_select_own"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "certificates_select_admin" ON public.certificates IS
  'Admins can see all certificates — needed for audit and verification.';

CREATE POLICY "certificates_select_admin"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "certificates_select_manager_department" ON public.certificates IS
  'Managers can see certificates for users in their department — tracks team certifications.';

CREATE POLICY "certificates_select_manager_department"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (is_manager_of(user_id));

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- Certificates are issued exclusively by the server (service role) after
-- verifying course completion and assessment passage. This prevents
-- users from creating fake certificates or modifying existing ones.
