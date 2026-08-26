-- =============================================================================
-- Seed Data: seed.sql
-- Purpose:   Insert realistic reference data for development and testing.
--
--            IMPORTANT: This file contains NO fake user data tied to real
--            auth accounts. All seeded data is reference/catalogue data only
--            (departments, domains, competencies, sample courses).
--
--            HOW TO USE:
--            1. Apply migrations first (see docs-hum/02-database-schema.md)
--            2. Run this seed file: psql -f seed.sql (or via Supabase SQL Editor)
--            3. The seed data is idempotent (uses ON CONFLICT DO NOTHING)
--               so you can re-run it safely.
-- =============================================================================

-- =============================================================================
-- DEPARTMENTS
-- =============================================================================
-- Core government departments involved in India's Official Statistical System.
INSERT INTO public.departments (name, code) VALUES
  ('Ministry of Statistics and Programme Implementation', 'MOSPI'),
  ('Central Statistical Office', 'CSO'),
  ('National Sample Survey Office', 'NSSO'),
  ('National Statistical Commission', 'NSC'),
  ('National Statistical System Training Academy', 'NSSTA'),
  ('Office of the Registrar General and Census Commissioner', 'ORGI'),
  ('Department of Economic Affairs', 'DEA'),
  ('NITI Aayog', 'NITI')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- COMPETENCY DOMAINS
-- =============================================================================
-- The four top-level domains from the requirement document.
INSERT INTO public.competency_domains (name, description) VALUES
  ('Statistical', 'Core statistical methodologies, survey design, sampling techniques, data analysis, and statistical inference — the foundational skills for India''s statistical system.'),
  ('Technical', 'Programming, database management, data engineering, cloud computing, and other technical skills needed to build and maintain modern data systems.'),
  ('Digital Governance', 'Digital literacy, cybersecurity awareness, data privacy, e-governance frameworks, and understanding of India''s digital public infrastructure.'),
  ('Behavioural & Managerial', 'Leadership, communication, project management, teamwork, problem-solving, and other soft skills essential for effective governance.')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- COMPETENCIES (sample under each domain)
-- =============================================================================
-- A realistic set of competencies to demonstrate the schema.
-- These are NOT exhaustive — the full list will be defined by domain experts.

-- Statistical competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Survey Design', 'Designing household and establishment surveys, including sampling frames, questionnaire design, and coverage planning.'),
  ('Sampling Techniques', 'Probability and non-probability sampling methods, stratification, clustering, and sample size determination.'),
  ('Data Analysis & Interpretation', 'Applying statistical methods to analyze data, identify patterns, and draw meaningful conclusions.'),
  ('Statistical Inference', 'Hypothesis testing, confidence intervals, regression analysis, and inferential statistics.'),
  ('Data Quality Assurance', 'Ensuring accuracy, completeness, consistency, and timeliness of statistical data through validation and editing.')
) AS c(name, description)
WHERE d.name = 'Statistical'
ON CONFLICT DO NOTHING;

-- Technical competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Python Programming', 'Writing Python scripts for data processing, analysis, and automation of statistical workflows.'),
  ('R Programming', 'Using R for statistical computing, data visualization, and advanced analytical modeling.'),
  ('SQL & Database Management', 'Writing SQL queries, designing database schemas, and managing PostgreSQL/Supabase databases.'),
  ('Data Engineering', 'Building and maintaining data pipelines, ETL processes, and data warehousing solutions.'),
  ('Cloud Computing', 'Working with cloud platforms (AWS, GCP, or Azure) for scalable data processing and storage.')
) AS c(name, description)
WHERE d.name = 'Technical'
ON CONFLICT DO NOTHING;

-- Digital Governance competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Data Privacy & Protection', 'Understanding the Digital Personal Data Protection Act, data classification, consent management, and privacy-by-design principles.'),
  ('Cybersecurity Awareness', 'Recognizing phishing, social engineering, and common attack vectors; following secure coding and data handling practices.'),
  ('E-Governance Frameworks', 'Understanding IndiaStack, DigiLocker, UMANG, and other digital public infrastructure components.'),
  ('Open Data & Data Sharing', 'Principles of open data, data anonymization, and responsible data sharing between government agencies.')
) AS c(name, description)
WHERE d.name = 'Digital Governance'
ON CONFLICT DO NOTHING;

-- Behavioural & Managerial competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Leadership', 'Guiding teams, making decisions under uncertainty, and fostering a culture of evidence-based governance.'),
  ('Communication', 'Clear written and verbal communication, data storytelling, and presenting findings to non-technical stakeholders.'),
  ('Project Management', 'Planning, executing, and monitoring projects using methodologies suited to government workflows.'),
  ('Critical Thinking', 'Evaluating evidence objectively, identifying biases in data and arguments, and making sound judgments.'),
  ('Collaboration', 'Working effectively across departments and with external stakeholders (academia, international organisations).')
) AS c(name, description)
WHERE d.name = 'Behavioural & Managerial'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE COURSES
-- =============================================================================
-- A handful of courses from different sources to demonstrate the schema.
-- These are realistic examples but NOT actual courses.
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Fundamentals of Survey Sampling', 'Introduction to probability sampling methods used in national statistical surveys.', 'igot', 'IGOT-SURV-101', 'https://igotkarmayogi.gov.in/course/survey-sampling-101', 8),
  ('Python for Statistical Analysis', 'Hands-on Python course covering data wrangling, visualization, and statistical modeling.', 'internal', NULL, NULL, 12),
  ('Data Privacy in Government', 'Understanding the Digital Personal Data Protection Act and implementing privacy safeguards.', 'nssta_tpac', 'NSSTA-PRIV-201', 'https://nssta.gov.in/tpac/data-privacy-201', 6),
  ('Advanced SQL for Data Analysis', 'Complex queries, window functions, CTEs, and database optimization for analytical work.', 'internal', NULL, NULL, 10),
  ('Leadership in Public Service', 'Developing leadership skills specific to government and statistical organisations.', 'igot', 'IGOT-LEAD-301', 'https://igotkarmayogi.gov.in/course/leadership-301', 4)
ON CONFLICT (source, external_id) DO NOTHING;

-- =============================================================================
-- COURSE-COMPETENCY MAPPINGS
-- =============================================================================
-- Link cour
