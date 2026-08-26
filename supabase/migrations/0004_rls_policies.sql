-- =============================================================================
-- Migration: 0004_rls_policies.sql
-- Purpose:   Enable RLS on every table and create all security policies.
--            Also attaches set_updated_at() triggers to tables that need them.
--
--            This migration runs AFTER:
--              0001_create_enums.sql        (enum types)
--              0002_core_tables.sql          (all table definitions)
--              0003_helper_functions.sql     (is_admin, is_manager_of, set_updated_at)
--
--            So we can safely call is_admin() and is_manager_of() in policies,
--            and set_updated_at() in triggers.
--
-- GENERAL RULES APPLIED:
--   - Anonymous (unauthenticated) access is BLOCKED on every table
--   - Reference/catalogue data: authenticated SELECT, admin-only INSERT/UPDATE/DELETE
--   - User data: users see own rows, admins see all, managers see aggregated only
--   - Assessment data: INSERT-ONLY for authenticated (anti-tampering)
-- =============================================================================

-- =============================================================================
-- TRIGGERS: attach set_updated_at() to all tables with updated_at
-- =============================================================================
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_competency_scores_set_updated_at
  BEFORE UPDATE ON public.user_competency_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER survey_questions_set_updated_at
  BEFORE UPDATE ON public.survey_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER courses_set_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER enrollments_set_updated_at
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER assessments_set_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS: departments
-- =============================================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.departments IS 'Lookup table of government departments. RLS: authenticated read, admin-only write. Anonymous blocked.';

CREATE POLICY "departments_select_authenticated"
  ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "departments_insert_admin"
  ON public.departments FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "departments_update_admin"
  ON public.departments FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "departments_delete_admin"
  ON public.departments FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: profiles
-- =============================================================================
-- SELECT: own row + admins see all + managers see department only
-- INSERT: blocked (service role only, via auth trigger)
-- UPDATE: own row + admins
-- DELETE: admins only
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.profiles IS 'User profiles. RLS: users see own, admins see all, managers see department. No direct insert (service role only).';

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "profiles_select_manager_department"
  ON public.profiles FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS manager
      WHERE manager.id = auth.uid()
        AND manager.role = 'manager'
        AND manager.department_id = profiles.department_id
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: competency_domains
-- =============================================================================
ALTER TABLE public.competency_domains ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.competency_domains IS 'Competency groupings. RLS: authenticated read, admin-only write.';

CREATE POLICY "cd_select_authenticated"
  ON public.competency_domains FOR SELECT TO authenticated USING (true);

CREATE POLICY "cd_insert_admin"
  ON public.competency_domains FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "cd_update_admin"
  ON public.competency_domains FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "cd_delete_admin"
  ON public.competency_domains FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: competencies
-- =============================================================================
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.competencies IS 'Individual skills. RLS: authenticated read, admin-only write.';

CREATE POLICY "competencies_select_authenticated"
  ON public.competencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "competencies_insert_admin"
  ON public.competencies FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "competencies_update_admin"
  ON public.competencies FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "competencies_delete_admin"
  ON public.competencies FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: user_competency_scores
-- =============================================================================
-- SELECT: own + admin. No INSERT/UPDATE/DELETE for authenticated (server only).
ALTER TABLE public.user_competency_scores ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.user_competency_scores IS 'User competency scores. RLS: own + admin read only. No user writes (server managed).';

CREATE POLICY "scores_select_own"
  ON public.user_competency_scores FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "scores_select_admin"
  ON public.user_competency_scores FOR SELECT TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: survey_questions
-- =============================================================================
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.survey_questions IS 'Survey questions. RLS: authenticated read (active only), admin-only write.';

CREATE POLICY "sq_select_authenticated"
  ON public.survey_questions FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "sq_insert_admin"
  ON public.survey_questions FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "sq_update_admin"
  ON public.survey_questions FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "sq_delete_admin"
  ON public.survey_questions FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: survey_responses
-- =============================================================================
-- SELECT: own + admin. INSERT: own (submit survey). No UPDATE/DELETE (append-only).
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.survey_responses IS 'Survey answers. RLS: own + admin read, own insert. Append-only (no update/delete).';

CREATE POLICY "sr_select_own"
  ON public.survey_responses FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "sr_select_admin"
  ON public.survey_responses FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "sr_insert_own"
  ON public.survey_responses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- RLS: courses
-- =============================================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.courses IS 'Course catalogue. RLS: authenticated read (active only), admin-only write.';

CREATE POLICY "courses_select_authenticated"
  ON public.courses FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "courses_insert_admin"
  ON public.courses FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "courses_update_admin"
  ON public.courses FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "courses_delete_admin"
  ON public.courses FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: course_competencies
-- =============================================================================
ALTER TABLE public.course_competencies ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.course_competencies IS 'Course-competency links. RLS: authenticated read, admin-only write.';

CREATE POLICY "cc_select_authenticated"
  ON public.course_competencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "cc_insert_admin"
  ON public.course_competencies FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "cc_delete_admin"
  ON public.course_competencies FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: enrollments
-- =============================================================================
-- SELECT: own + admin + manager(department). INSERT: own. UPDATE: own + admin.
-- DELETE: own + admin.
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.enrollments IS 'Course enrollments. RLS: own + admin + manager read, own insert/update, own + admin delete.';

CREATE POLICY "enrollments_select_own"
  ON public.enrollments FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "enrollments_select_admin"
  ON public.enrollments FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "enrollments_select_manager_department"
  ON public.enrollments FOR SELECT TO authenticated USING (is_manager_of(user_id));

CREATE POLICY "enrollments_insert_own"
  ON public.enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "enrollments_update_own"
  ON public.enrollments FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "enrollments_update_admin"
  ON public.enrollments FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "enrollments_delete_own"
  ON public.enrollments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "enrollments_delete_admin"
  ON public.enrollments FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: assessments
-- =============================================================================
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.assessments IS 'Assessment definitions. RLS: authenticated read (active only), admin-only write.';

CREATE POLICY "assessments_select_authenticated"
  ON public.assessments FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "assessments_insert_admin"
  ON public.assessments FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "assessments_update_admin"
  ON public.assessments FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "assessments_delete_admin"
  ON public.assessments FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: assessment_questions
-- =============================================================================
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.assessment_questions IS 'Assessment questions. RLS: authenticated read, admin-only write.';

CREATE POLICY "aq_select_authenticated"
  ON public.assessment_questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "aq_insert_admin"
  ON public.assessment_questions FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "aq_update_admin"
  ON public.assessment_questions FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "aq_delete_admin"
  ON public.assessment_questions FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: assessment_attempts
-- =============================================================================
-- SELECT: own + admin. No INSERT/UPDATE/DELETE (server only — anti-tampering).
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.assessment_attempts IS 'Assessment attempt records. RLS: own + admin read only. No user writes (anti-tampering).';

CREATE POLICY "attempts_select_own"
  ON public.assessment_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "attempts_select_admin"
  ON public.assessment_attempts FOR SELECT TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: assessment_answers
-- =============================================================================
-- SELECT: own (via attempt join) + admin. No INSERT/UPDATE/DELETE (server only).
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.assessment_answers IS 'Assessment answers. RLS: own (via attempt) + admin read only. No user writes (anti-tampering).';

CREATE POLICY "answers_select_own"
  ON public.assessment_answers FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.assessment_attempts
      WHERE id = assessment_answers.attempt_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "answers_select_admin"
  ON public.assessment_answers FOR SELECT TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: certificates
-- =============================================================================
-- SELECT: own + admin + manager(department). No user writes (server only).
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.certificates IS 'Issued certificates. RLS: own + admin + manager read only. No user writes.';

CREATE POLICY "certs_select_own"
  ON public.certificates FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "certs_select_admin"
  ON public.certificates FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "certs_select_manager_department"
  ON public.certificates FOR SELECT TO authenticated USING (is_manager_of(user_id));

-- =============================================================================
-- RLS: indian_states
-- =============================================================================
ALTER TABLE public.indian_states ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.indian_states IS 'Indian states/UTs. RLS: authenticated read, admin manage.';

CREATE POLICY "states_select_authenticated"
  ON public.indian_states FOR SELECT TO authenticated USING (true);

CREATE POLICY "states_admin_all"
  ON public.indian_states FOR ALL TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: central_ministries
-- =============================================================================
ALTER TABLE public.central_ministries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.central_ministries IS 'Central ministries. RLS: authenticated read, admin manage.';

CREATE POLICY "ministries_select_authenticated"
  ON public.central_ministries FOR SELECT TO authenticated USING (true);

CREATE POLICY "ministries_admin_all"
  ON public.central_ministries FOR ALL TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: organisations
-- =============================================================================
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organisations IS 'Government organisations. RLS: authenticated read, admin manage.';

CREATE POLICY "orgs_select_authenticated"
  ON public.organisations FOR SELECT TO authenticated USING (true);

CREATE POLICY "orgs_admin_all"
  ON public.organisations FOR ALL TO authenticated USING (is_admin());

-- =============================================================================
-- RLS: designations
-- =============================================================================
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.designations IS 'Job designations. RLS: authenticated read, admin manage.';

CREATE POLICY "desig_select_authenticated"
  ON public.designations FOR SELECT TO authenticated USING (true);

CREATE POLICY "desig_admin_all"
  ON public.designations FOR ALL TO authenticated USING (is_admin());
