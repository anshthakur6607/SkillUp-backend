-- =============================================================================
-- Migration: 0009_indexes.sql
-- Purpose:   Create indexes on all foreign key columns and frequently
--            queried/joined columns.
--
--            WHY INDEXES MATTER WITH RLS:
--            RLS policies run a WHERE clause check on EVERY query.
--            For example, "WHERE user_id = auth.uid()" runs as part of
--            every SELECT on assessment_answers. Without an index on
--            user_id, Postgres must scan the entire table for every query.
--            With millions of rows, this would be catastrophically slow.
--
--            Indexes on foreign keys also speed up JOINs, which are
--            used extensively in our schema (e.g. joining profiles to
--            departments, enrollments to courses, etc.).
-- =============================================================================

-- =============================================================================
-- profiles indexes
-- =============================================================================
-- RLS policies filter on profiles.id (auth.uid()) and profiles.role.
-- department_id is used for manager lookups and JOINs.
CREATE INDEX idx_profiles_department_id ON public.profiles (department_id);
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- =============================================================================
-- competencies indexes
-- =============================================================================
-- domain_id is used for JOINs when listing competencies by domain.
CREATE INDEX idx_competencies_domain_id ON public.competencies (domain_id);

-- =============================================================================
-- user_competency_scores indexes
-- =============================================================================
-- user_id is the primary RLS filter ("show me MY scores").
-- competency_id is used for aggregate queries ("who is weak in X?").
CREATE INDEX idx_scores_user_id ON public.user_competency_scores (user_id);
CREATE INDEX idx_scores_competency_id ON public.user_competency_scores (competency_id);

-- =============================================================================
-- survey_questions indexes
-- =============================================================================
-- competency_id is used for JOINs ("which questions test this competency?").
-- department_scope is used for filtering questions by department.
CREATE INDEX idx_survey_questions_competency_id ON public.survey_questions (competency_id);
CREATE INDEX idx_survey_questions_department_scope ON public.survey_questions (department_scope);

-- =============================================================================
-- survey_responses indexes
-- =============================================================================
-- user_id is the primary RLS filter ("show me MY responses").
-- question_id is used for aggregate queries ("how did everyone answer Q1?").
CREATE INDEX idx_survey_responses_user_id ON public.survey_responses (user_id);
CREATE INDEX idx_survey_responses_question_id ON public.survey_responses (question_id);

-- =============================================================================
-- course_competencies indexes
-- =============================================================================
-- Both columns are used in JOINs and WHERE clauses.
-- competency_id reverse lookup: "which courses cover competency X?"
CREATE INDEX idx_course_competencies_competency_id ON public.course_competencies (competency_id);

-- =============================================================================
-- enrollments indexes
-- =============================================================================
-- user_id is the primary RLS filter ("show me MY enrollments").
-- course_id is used for queries like "who is enrolled in course X?"
-- status is frequently filtered ("show me in_progress enrollments").
CREATE INDEX idx_enrollments_user_id ON public.enrollments (user_id);
CREATE INDEX idx_enrollments_course_id ON public.enrollments (course_id);
CREATE INDEX idx_enrollments_status ON public.enrollments (status);

-- =============================================================================
-- assessments indexes
-- =============================================================================
-- course_id is used for JOINs ("which assessments belong to this course?").
CREATE INDEX idx_assessments_course_id ON public.assessments (course_id);

-- =============================================================================
-- assessment_questions indexes
-- =============================================================================
-- assessment_id is used for JOINs ("get all questions for this assessment").
-- competency_id is used for aggregate queries ("which competencies does this assessment test?").
CREATE INDEX idx_assessment_questions_assessment_id ON public.assessment_questions (assessment_id);
CREATE INDEX idx_assessment_questions_competency_id ON public.assessment_questions (competency_id);
CREATE INDEX idx_assessment_questions_difficulty ON public.assessment_questions (difficulty);

-- =============================================================================
-- assessment_attempts indexes
-- =============================================================================
-- user_id is the primary RLS filter ("show me MY attempts").
-- assessment_id is used for queries like "who has taken this assessment?"
CREATE INDEX idx_assessment_attempts_user_id ON public.assessment_attempts (user_id);
CREATE INDEX idx_assessment_attempts_assessment_id ON public.assessment_attempts (assessment_id);

-- =============================================================================
-- assessment_answers indexes
-- =============================================================================
-- attempt_id is used for JOINs ("get all answers for this attempt").
-- question_id is used for aggregate queries ("how did everyone answer Q5?").
-- The composite index on (attempt_id, question_id) supports the UNIQUE
-- constraint and also speeds up lookups by attempt.
CREATE INDEX idx_assessment_answers_attempt_id ON public.assessment_answers (attempt_id);
CREATE INDEX idx_assessment_answers_question_id ON public.assessment_answers (question_id);

-- =============================================================================
-- certificates indexes
-- =============================================================================
-- user_id is the primary RLS filter ("show me MY certificates").
-- course_id is used for queries like "who has a certificate for course X?"
-- verification_code is used for public verification endpoint.
CREATE INDEX idx_certificates_user_id ON public.certificates (user_id);
CREATE INDEX idx_certificates_course_id ON public.certificates (course_id);
CREATE INDEX idx_certificates_verification_code ON public.certificates (verification_code);
