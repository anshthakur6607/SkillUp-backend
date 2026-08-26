-- =============================================================================
-- Migration: 0005_indexes.sql
-- Purpose:   Create indexes on all foreign key columns and frequently
--            queried/joined columns.
--
--            WHY INDEXES MATTER WITH RLS:
--            RLS policies run a WHERE clause check on EVERY query.
--            For example, "WHERE user_id = auth.uid()" runs as part of
--            every SELECT. Without an index, Postgres scans the entire table.
-- =============================================================================

-- profiles
CREATE INDEX idx_profiles_department_id ON public.profiles (department_id);
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- competencies
CREATE INDEX idx_competencies_domain_id ON public.competencies (domain_id);

-- user_competency_scores
CREATE INDEX idx_scores_user_id ON public.user_competency_scores (user_id);
CREATE INDEX idx_scores_competency_id ON public.user_competency_scores (competency_id);

-- survey_questions
CREATE INDEX idx_survey_questions_competency_id ON public.survey_questions (competency_id);
CREATE INDEX idx_survey_questions_department_scope ON public.survey_questions (department_scope);

-- survey_responses
CREATE INDEX idx_survey_responses_user_id ON public.survey_responses (user_id);
CREATE INDEX idx_survey_responses_question_id ON public.survey_responses (question_id);

-- course_competencies
CREATE INDEX idx_course_competencies_competency_id ON public.course_competencies (competency_id);

-- enrollments
CREATE INDEX idx_enrollments_user_id ON public.enrollments (user_id);
CREATE INDEX idx_enrollments_course_id ON public.enrollments (course_id);
CREATE INDEX idx_enrollments_status ON public.enrollments (status);

-- assessments
CREATE INDEX idx_assessments_course_id ON public.assessments (course_id);

-- assessment_questions
CREATE INDEX idx_assessment_questions_assessment_id ON public.assessment_questions (assessment_id);
CREATE INDEX idx_assessment_questions_competency_id ON public.assessment_questions (competency_id);
CREATE INDEX idx_assessment_questions_difficulty ON public.assessment_questions (difficulty);

-- assessment_attempts
CREATE INDEX idx_assessment_attempts_user_id ON public.assessment_attempts (user_id);
CREATE INDEX idx_assessment_attempts_assessment_id ON public.assessment_attempts (assessment_id);

-- assessment_answers
CREATE INDEX idx_assessment_answers_attempt_id ON public.assessment_answers (attempt_id);
CREATE INDEX idx_assessment_answers_question_id ON public.assessment_answers (question_id);

-- certificates
CREATE INDEX idx_certificates_user_id ON public.certificates (user_id);
CREATE INDEX idx_certificates_course_id ON public.certificates (course_id);
CREATE INDEX idx_certificates_verification_code ON public.certificates (verification_code);

-- organisations (lookup table indexes for profile setup filtering)
CREATE INDEX idx_organisations_ministry ON public.organisations (ministry);
CREATE INDEX idx_organisations_state ON public.organisations (state);
CREATE INDEX idx_organisations_type ON public.organisations (org_type);
