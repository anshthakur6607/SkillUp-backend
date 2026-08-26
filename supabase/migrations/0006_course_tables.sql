-- =============================================================================
-- Migration: 0006_course_tables.sql
-- Purpose:   Create course-related tables: courses, course_competencies,
--            and enrollments.
--
--            These tables track available learning content and user progress.
--            Courses can come from multiple sources (iGOT, internal, NSSTA TPAC).
-- =============================================================================

-- =============================================================================
-- TABLE: courses
-- =============================================================================
-- Course metadata. Each course has a source indicating where the content
-- comes from:
--   - 'igot': from the iGOT Karmayogi platform (external government LMS)
--   - 'internal': created within this system
--   - 'nssta_tpac': from NSSTA TPAC (National Statistical System Training Academy)
--
-- For external courses (iGOT, NSSTA), external_id and external_url store
-- the reference to the original platform. For internal courses, these are NULL.
--
-- content_chunks_ref is a placeholder for future RAG (Retrieval-Augmented
-- Generation) use — it will store a reference to vector embeddings of the
-- course content for the AI chatbot feature.
-- =============================================================================
CREATE TABLE public.courses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                text NOT NULL,
  description          text,
  source               course_source NOT NULL DEFAULT 'internal',
  external_id          text,                  -- ID on the external platform (e.g. iGOT course ID)
  external_url         text,                  -- URL to the course on the external platform
  duration_hours       numeric CHECK (duration_hours > 0),
  content_chunks_ref   text,                  -- placeholder for future RAG vector embeddings
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate courses from the same source with the same external ID
  UNIQUE (source, external_id)
);

COMMENT ON TABLE public.courses IS
  'Course metadata. Sources include iGOT Karmayogi, internal courses, and NSSTA TPAC. Each course links to competencies it addresses.';

COMMENT ON COLUMN public.courses.source IS
  'Where the course originates: igot (iGOT Karmayogi), internal (created here), nssta_tpac (NSSTA Training Academy).';

COMMENT ON COLUMN public.courses.external_id IS
  'Course ID on the external platform. Used to cross-reference with iGOT/NSSTA systems.';

COMMENT ON COLUMN public.courses.content_chunks_ref IS
  'Future: reference to vector embeddings for RAG-based AI chatbot. Not used yet.';

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TABLE: course_competencies
-- =============================================================================
-- Many-to-many join table: links courses to the competencies they address.
-- A course can cover multiple competencies (e.g. a "Data Analysis with Python"
-- course covers both "Python" and "Data Analysis" competencies).
-- A competency can be addressed by multiple courses.
-- =============================================================================
CREATE TABLE public.course_competencies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  competency_id  uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (course_id, competency_id)
);

COMMENT ON TABLE public.course_competencies IS
  'Many-to-many join: which competencies each course addresses. Used for course recommendations and gap analysis.';

COMMENT ON COLUMN public.course_competencies.course_id IS
  'FK to courses. CASCADE: if a course is deleted, its competency links go too.';

COMMENT ON COLUMN public.course_competencies.competency_id IS
  'FK to competencies. CASCADE: if a competency is deleted, course links go too.';

-- =============================================================================
-- TABLE: enrollments
-- =============================================================================
-- Per-user course enrollment and progress tracking. Each row represents
-- one user's enrollment in one course.
--
-- progress_percent tracks how far through the course the user has gotten
-- (0-100). The status field tracks the lifecycle:
--   - not_started: enrolled but haven't begun
--   - in_progress: actively working through the course
--   - completed: finished the course
-- =============================================================================
CREATE TABLE public.enrollments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id         uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status            enrollment_status NOT NULL DEFAULT 'not_started',
  progress_percent  numeric CHECK (progress_percent >= 0 AND progress_percent <= 100) DEFAULT 0,
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- One enrollment per user per course
  UNIQUE (user_id, course_id)
);

COMMENT ON TABLE public.enrollments IS
  'Per-user course enrollment and progress. Tracks status (not_started/in_progress/completed) and completion percentage.';

COMMENT ON COLUMN public.enrollments.status IS
  'Lifecycle: not_started (just enrolled), in_progress (actively learning), completed (finished).';

COMMENT ON COLUMN public.enrollments.progress_percent IS
  'How far through the course the user has progressed (0-100). Updated as they complete content chunks.';

COMMENT ON COLUMN public.enrollments.completed_at IS
  'NULL until the course is finished. Set once when status changes to completed.';

CREATE TRIGGER enrollments_set_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS: courses
-- =============================================================================
-- Reference/catalogue data: any authenticated user can read courses.
-- Only admins can create, edit, or deactivate courses.
-- Anonymous access is blocked.
-- =============================================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "courses_select_authenticated" ON public.courses IS
  'Authenticated users can view active courses (needed for course catalog and enrollment).';

CREATE POLICY "courses_select_authenticated"
  ON public.courses FOR SELECT
  TO authenticated
  USING (is_active = true);

COMMENT ON POLICY "courses_insert_admin" ON public.courses IS
  'Only admins can create new courses.';

CREATE POLICY "courses_insert_admin"
  ON public.courses FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "courses_update_admin" ON public.courses IS
  'Only admins can modify course details.';

CREATE POLICY "courses_update_admin"
  ON public.courses FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "courses_delete_admin" ON public.courses IS
  'Only admins can delete courses. Prefer deactivating (is_active = false) to preserve enrollment history.';

CREATE POLICY "courses_delete_admin"
  ON public.courses FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: course_competencies
-- =========================
-- =============================================================================
-- RLS: course_competencies
-- =============================================================================
-- Junction table: authenticated users can read (needed to show which
-- competencies a course covers). Only admins can manage the mappings.
-- Anonymous access is blocked.
-- =============================================================================
ALTER TABLE public.course_competencies ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "course_competencies_select_authenticated" ON public.course_competencies IS
  'Authenticated users can view course-competency mappings (needed for course details and recommendations).';

CREATE POLICY "course_competencies_select_authenticated"
  ON public.course_competencies FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "course_competencies_insert_admin" ON public.course_competencies IS
  'Only admins can link courses to competencies.';

CREATE POLICY "course_competencies_insert_admin"
  ON public.course_competencies FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

COMMENT ON POLICY "course_competencies_delete_admin" ON public.course_competencies IS
  'Only admins can remove course-competency links.';

CREATE POLICY "course_competencies_delete_admin"
  ON public.course_competencies FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- RLS: enrollments
-- =============================================================================
-- ACCESS RULES:
--   SELECT:
--     - Users can see their own enrollments (user_id = auth.uid())
--     - Admins can see all enrollments
--     - Managers can see enrollments for users in their department
--       (for tracking team learning progress)
--   INSERT:
--     - Users can enroll themselves (user_id = auth.uid())
--       The server should also be able to enroll users via service role.
--   UPDATE:
--     - Users can update their own enrollments (progress, status)
--       The server updates progress as the user completes content.
--     - Admins can update any enrollment (e.g. reset progress, mark complete)
--   DELETE:
--     - Users can unenroll themselves (withdraw from a course)
--     - Admins can remove any enrollment
-- =============================================================================
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "enrollments_select_own" ON public.enrollments IS
  'Users can see their own enrollments — needed for "My Courses" view.';

CREATE POLICY "enrollments_select_own"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "enrollments_select_admin" ON public.enrollments IS
  'Admins can see all enrollments — needed for system-wide analytics.';

CREATE POLICY "enrollments_select_admin"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "enrollments_select_manager_department" ON public.enrollments IS
  'Managers can see enrollments for users in their department — tracks team learning progress.';

CREATE POLICY "enrollments_select_manager_department"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (is_manager_of(user_id));

COMMENT ON POLICY "enrollments_insert_own" ON public.enrollments IS
  'Users can enroll themselves in courses. The user_id must match auth.uid().';

CREATE POLICY "enrollments_insert_own"
  ON public.enrollments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "enrollments_update_own" ON public.enrollments IS
  'Users can update their own enrollment progress and status.';

CREATE POLICY "enrollments_update_own"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "enrollments_update_admin" ON public.enrollments IS
  'Admins can update any enrollment — e.g. reset progress, force-complete.';

CREATE POLICY "enrollments_update_admin"
  ON public.enrollments FOR UPDATE
  TO authenticated
  USING (is_admin());

COMMENT ON POLICY "enrollments_delete_own" ON public.enrollments IS
  'Users can unenroll themselves (withdraw from a course).';

CREATE POLICY "enrollments_delete_own"
  ON public.enrollments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "enrollments_delete_admin" ON public.enrollments IS
  'Admins can delete any enrollment.';

CREATE POLICY "enrollments_delete_admin"
  ON public.enrollments FOR DELETE
  TO authenticated
  USING (is_admin());
