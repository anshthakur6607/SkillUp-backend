-- =============================================================================
-- Seed Data: seed.sql
-- Purpose:   Insert realistic reference data for development and testing.
--            NO fake user data tied to real auth accounts.
--            Run AFTER all migrations (0001-0007).
--            Idempotent (uses ON CONFLICT DO NOTHING) — safe to re-run.
-- =============================================================================

-- =============================================================================
-- DEPARTMENTS
-- =============================================================================
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
INSERT INTO public.competency_domains (name, description) VALUES
  ('Statistical', 'Core statistical methodologies, survey design, sampling techniques, data analysis, and statistical inference.'),
  ('Technical', 'Programming, database management, data engineering, cloud computing, and other technical skills.'),
  ('Digital Governance', 'Digital literacy, cybersecurity awareness, data privacy, e-governance frameworks, and digital public infrastructure.'),
  ('Behavioural & Managerial', 'Leadership, communication, project management, teamwork, problem-solving, and other soft skills.')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- COMPETENCIES
-- =============================================================================

-- Statistical competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Survey Design', 'Designing household and establishment surveys, including sampling frames and questionnaire design.'),
  ('Sampling Techniques', 'Probability and non-probability sampling methods, stratification, clustering, and sample size determination.'),
  ('Data Analysis & Interpretation', 'Applying statistical methods to analyze data, identify patterns, and draw meaningful conclusions.'),
  ('Statistical Inference', 'Hypothesis testing, confidence intervals, regression analysis, and inferential statistics.'),
  ('Data Quality Assurance', 'Ensuring accuracy, completeness, consistency, and timeliness of statistical data.')
) AS c(name, description)
WHERE d.name = 'Statistical'
ON CONFLICT DO NOTHING;

-- Technical competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Python Programming', 'Writing Python scripts for data processing, analysis, and automation.'),
  ('R Programming', 'Using R for statistical computing, data visualization, and analytical modeling.'),
  ('SQL & Database Management', 'Writing SQL queries, designing schemas, and managing PostgreSQL/Supabase databases.'),
  ('Data Engineering', 'Building and maintaining data pipelines, ETL processes, and data warehousing.'),
  ('Cloud Computing', 'Working with cloud platforms for scalable data processing and storage.')
) AS c(name, description)
WHERE d.name = 'Technical'
ON CONFLICT DO NOTHING;

-- Digital Governance competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Data Privacy & Protection', 'Understanding the Digital Personal Data Protection Act and privacy-by-design principles.'),
  ('Cybersecurity Awareness', 'Recognizing phishing, social engineering, and common attack vectors.'),
  ('E-Governance Frameworks', 'Understanding IndiaStack, DigiLocker, UMANG, and digital public infrastructure.'),
  ('Open Data & Data Sharing', 'Principles of open data, anonymization, and responsible data sharing.')
) AS c(name, description)
WHERE d.name = 'Digital Governance'
ON CONFLICT DO NOTHING;

-- Behavioural & Managerial competencies
INSERT INTO public.competencies (domain_id, name, description)
SELECT d.id, c.name, c.description
FROM public.competency_domains d
CROSS JOIN (VALUES
  ('Leadership', 'Guiding teams, making decisions under uncertainty, fostering evidence-based governance.'),
  ('Communication', 'Clear written and verbal communication, data storytelling, presenting to non-technical stakeholders.'),
  ('Project Management', 'Planning, executing, and monitoring projects using government-suited methodologies.'),
  ('Critical Thinking', 'Evaluating evidence objectively, identifying biases, and making sound judgments.'),
  ('Collaboration', 'Working effectively across departments and with external stakeholders.')
) AS c(name, description)
WHERE d.name = 'Behavioural & Managerial'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COURSES — iGOT Karmayogi Full Catalog
-- =============================================================================
-- Organized by category: Behavioural, Functional, Domain, Mandatory
-- Source: iGOT Karmayogi platform (https://igotkarmayogi.gov.in)
-- =============================================================================

-- ─── BEHAVIOURAL ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Ethics in Governance', 'Understanding ethical frameworks, integrity, and transparency in public service delivery.', 'igot', 'IGOT-ETH-101', 'https://igotkarmayogi.gov.in/course/ethics-governance', 4),
  ('Prevention of Sexual Harassment at Workplace', 'Mandatory course on POSH Act compliance, awareness, and reporting mechanisms.', 'igot', 'IGOT-POSH-101', 'https://igotkarmayogi.gov.in/course/posh-101', 1),
  ('Leadership Fundamentals', 'Core leadership principles for government officials — decision-making, delegation, and team management.', 'igot', 'IGOT-LEAD-101', 'https://igotkarmayogi.gov.in/course/leadership-101', 3),
  ('Effective Communication in Government', 'Writing clear office notes, RTI responses, and official correspondence.', 'igot', 'IGOT-COMM-101', 'https://igotkarmayogi.gov.in/course/communication-101', 2),
  ('Right to Information Act — Practical Guide', 'Understanding RTI obligations, exemptions, and efficient response handling.', 'igot', 'IGOT-RTI-101', 'https://igotkarmayogi.gov.in/course/rti-101', 2),
  ('Conduct Rules for Central Government Employees', 'CCS (Conduct) Rules, discipline, and accountability in government service.', 'igot', 'IGOT-CCS-101', 'https://igotkarmayogi.gov.in/course/ccs-conduct-101', 2),
  ('Yoga and Wellness for Government Employees', 'Pranayama, stress management, and wellness practices for improved work performance.', 'igot', 'IGOT-YOGA-101', 'https://igotkarmayogi.gov.in/course/yoga-wellness', 1),
  ('Gender Sensitization in Government', 'Creating inclusive workplaces, understanding gender bias, and promoting equality.', 'igot', 'IGOT-GENDER-101', 'https://igotkarmayogi.gov.in/course/gender-sensitization', 2)
ON CONFLICT (source, external_id) DO NOTHING;

-- ─── FUNCTIONAL ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Financial Management for Government', 'Budget preparation, expenditure management, and GFR compliance.', 'igot', 'IGOT-FM-101', 'https://igotkarmayogi.gov.in/course/financial-mgmt-101', 4),
  ('Government Procurement (GEM)', 'GeM portal usage, tendering processes, and procurement rules.', 'igot', 'IGOT-PROC-101', 'https://igotkarmayogi.gov.in/course/procurement-gem', 3),
  ('Microsoft Office Suite for Government', 'Word, Excel, PowerPoint — essential digital skills for daily office work.', 'igot', 'IGOT-MS-101', 'https://igotkarmayogi.gov.in/course/ms-office-101', 4),
  ('Advanced Excel for Data Analysis', 'Pivot tables, VLOOKUP, data visualization, and reporting for government officials.', 'igot', 'IGOT-Excel-201', 'https://igotkarmayogi.gov.in/course/advanced-excel', 6),
  ('SPARROW — Performance Management System', 'How to fill and manage APAR/ACR on the SPARROW portal.', 'igot', 'IGOT-SPARROW-101', 'https://igotkarmayogi.gov.in/course/sparrow-101', 1),
  ('General Financial Rules (GFR) 2017', 'Comprehensive guide to GFR — delegation, financial powers, and audit compliance.', 'igot', 'IGOT-GFR-201', 'https://igotkarmayogi.gov.in/course/gfr-201', 5),
  ('CCS (CCA) Rules — Classification & Control', 'Understanding classification of posts, service rules, and disciplinary proceedings.', 'igot', 'IGOT-CCR-101', 'https://igotkarmayogi.gov.in/course/ccs-cca-rules', 3),
  ('MGNREGA — Implementation & Monitoring', 'Managing MGNREGA works, social audit, and convergence with other schemes.', 'igot', 'IGOT-MGNEREGA-101', 'https://igotkarmayogi.gov.in/course/mgnrega-101', 4)
ON CONFLICT (source, external_id) DO NOTHING;

-- ─── DOMAIN (Statistical) ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Fundamentals of Survey Sampling', 'Introduction to probability sampling methods used in national statistical surveys.', 'igot', 'IGOT-SURV-101', 'https://igotkarmayogi.gov.in/course/survey-sampling-101', 8),
  ('Advanced Statistical Methods', 'Regression analysis, time series, and hypothesis testing for government surveys.', 'igot', 'IGOT-STAT-201', 'https://igotkarmayogi.gov.in/course/adv-stats-201', 10),
  ('Data Quality Assurance in Surveys', 'Ensuring accuracy, completeness, and consistency in statistical data collection.', 'igot', 'IGOT-DQA-101', 'https://igotkarmayogi.gov.in/course/data-quality-101', 4),
  ('Consumer Price Index — Calculation & Interpretation', 'Understanding CPI methodology, weightage, and its role in economic policy.', 'igot', 'IGOT-CPI-101', 'https://igotkarmayogi.gov.in/course/cpi-101', 3),
  ('National Sample Survey — Design & Execution', 'NSSO survey methodology, field operations, and data processing.', 'igot', 'IGOT-NSS-101', 'https://igotkarmayogi.gov.in/course/nss-101', 6),
  ('National Accounts — GDP Calculation', 'GDP estimation methodology, base year revision, and national accounts compilation.', 'igot', 'IGOT-GDP-101', 'https://igotkarmayogi.gov.in/course/gdp-calculation', 5)
ON CONFLICT (source, external_id) DO NOTHING;

-- ─── DOMAIN (Technical/Digital) ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Python Programming for Beginners', 'Introduction to Python — variables, loops, functions, and basic data structures.', 'igot', 'IGOT-PY-101', 'https://igotkarmayogi.gov.in/course/python-101', 8),
  ('Python for Data Analysis', 'Hands-on Python for data wrangling, visualization, and statistical modeling using Pandas and Matplotlib.', 'igot', 'IGOT-PY-201', 'https://igotkarmayogi.gov.in/course/python-data-201', 12),
  ('SQL for Government Data Management', 'Writing SQL queries, designing schemas, and managing government databases.', 'igot', 'IGOT-SQL-101', 'https://igotkarmayogi.gov.in/course/sql-101', 6),
  ('R Programming for Statistical Computing', 'Using R for data analysis, visualization, and statistical modeling.', 'igot', 'IGOT-R-101', 'https://igotkarmayogi.gov.in/course/r-programming', 8),
  ('Introduction to Artificial Intelligence', 'Understanding AI concepts, machine learning basics, and government use cases.', 'igot', 'IGOT-AI-101', 'https://igotkarmayogi.gov.in/course/ai-intro-101', 4),
  ('Digital Personal Data Protection Act, 2023', 'Understanding the DPDP Act, consent management, and data fiduciary obligations.', 'igot', 'IGOT-DP-101', 'https://igotkarmayogi.gov.in/course/dpdp-act-101', 3),
  ('Cybersecurity Awareness for Government', 'Recognizing phishing, social engineering, and common cyber attack vectors.', 'igot', 'IGOT-CYBER-101', 'https://igotkarmayogi.gov.in/course/cybersecurity-101', 2),
  ('Digital India — E-Governance Frameworks', 'IndiaStack, DigiLocker, UMANG, and digital public infrastructure for government.', 'igot', 'IGOT-DIG-101', 'https://igotkarmayogi.gov.in/course/digital-india-101', 3),
  ('GIS and Remote Sensing for Government', 'Using geographic information systems for planning, monitoring, and data visualization.', 'igot', 'IGOT-GIS-101', 'https://igotkarmayogi.gov.in/course/gis-101', 6),
  ('Introduction to Bharatiya Nyaya Sanhita, 2023', 'Understanding the new criminal law replacing IPC — key changes and implications.', 'igot', 'IGOT-BNS-101', 'https://igotkarmayogi.gov.in/course/bns-101', 4),
  ('Introduction to Bharatiya Nagarik Suraksha Sanhita, 2023', 'New criminal procedure code — changes in investigation, trial, and bail provisions.', 'igot', 'IGOT-BNSS-101', 'https://igotkarmayogi.gov.in/course/bnss-101', 4),
  ('Open Data and Data Sharing in Government', 'Principles of open data, anonymization, and responsible data sharing.', 'igot', 'IGOT-OD-101', 'https://igotkarmayogi.gov.in/course/open-data-101', 3)
ON CONFLICT (source, external_id) DO NOTHING;

-- ─── MANDATORY (APAR-Linked) ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Annual Performance Appraisal Report (APAR) — Complete Guide', 'How to write, review, and complete APAR on SPARROW — mandatory for all officials.', 'igot', 'IGOT-APAR-101', 'https://igotkarmayogi.gov.in/course/apar-complete-guide', 1),
  ('Annual Confidential Report (ACR) Best Practices', 'Writing effective self-appraisals and peer reviews for career progression.', 'igot', 'IGOT-ARC-101', 'https://igotkarmayogi.gov.in/course/acr-best-practices', 1),
  ('Official Secrets Act — Security Awareness', 'Classification of documents, handling sensitive information, and security protocols.', 'igot', 'IGOT-SEC-101', 'https://igotkarmayogi.gov.in/course/official-secrets-101', 2),
  ('Citizen Charter and Service Delivery', 'Understanding citizen charters, grievance redressal, and transparent governance.', 'igot', 'IGOT-CC-101', 'https://igotkarmayogi.gov.in/course/citizen-charter', 2),
  ('Internal Complaints Committee — POSH Act', 'Roles and responsibilities of ICC members, inquiry procedures, and reporting.', 'igot', 'IGOT-POSH-ADV', 'https://igotkarmayogi.gov.in/course/icc-posh', 2),
  ('Central Civil Services (CCA) Rules — Advanced', 'Detailed study of CCA Rules for officers handling disciplinary matters.', 'igot', 'IGOT-CCA-ADV', 'https://igotkarmayogi.gov.in/course/cca-advanced', 4)
ON CONFLICT (source, external_id) DO NOTHING;

-- ─── NSSTA TPAC ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Data Privacy in Government (NSSTA)', 'Understanding the Digital Personal Data Protection Act and implementing privacy safeguards.', 'nssta_tpac', 'NSSTA-PRIV-201', 'https://nssta.gov.in/tpac/data-privacy-201', 6),
  ('Advanced Survey Methods Workshop', '5-day intensive workshop on advanced sampling and estimation techniques.', 'nssta_tpac', 'NSSTA-SURV-301', 'https://nssta.gov.in/tpac/survey-advanced-301', 40)
ON CONFLICT (source, external_id) DO NOTHING;

-- ─── INTERNAL ───
INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  ('Python for Statistical Analysis', 'Hands-on Python course covering data wrangling, visualization, and statistical modeling.', 'internal', NULL, NULL, 12),
  ('Advanced SQL for Data Analysis', 'Complex queries, window functions, CTEs, and database optimization.', 'internal', NULL, NULL, 10)
ON CONFLICT (source, external_id) DO NOTHING;

-- =============================================================================
-- COURSE-COMPETENCY MAPPINGS
-- Maps each course to the competencies it addresses.
-- Used by the recommendation engine to suggest courses for skill gaps.
-- =============================================================================

-- ─── Behavioural courses ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-ETH-101' AND comp.name IN ('Leadership', 'Critical Thinking')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-POSH-101' AND comp.name IN ('Communication', 'Collaboration')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-LEAD-101' AND comp.name IN ('Leadership', 'Project Management')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-COMM-101' AND comp.name = 'Communication'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-RTI-101' AND comp.name IN ('Communication', 'Critical Thinking')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-CCS-101' AND comp.name = 'Leadership'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-YOGA-101' AND comp.name = 'Collaboration'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-GENDER-101' AND comp.name IN ('Communication', 'Collaboration')
ON CONFLICT DO NOTHING;

-- ─── Functional courses ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-FM-101' AND comp.name = 'Project Management'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-PROC-101' AND comp.name = 'Project Management'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-MS-101' AND comp.name = 'Python Programming'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-Excel-201' AND comp.name IN ('Python Programming', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-SPARROW-101' AND comp.name = 'Project Management'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-GFR-201' AND comp.name IN ('Project Management', 'Critical Thinking')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-CCR-101' AND comp.name = 'Leadership'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-MGNEREGA-101' AND comp.name IN ('Project Management', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

-- ─── Domain (Statistical) ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-SURV-101' AND comp.name IN ('Survey Design', 'Sampling Techniques')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-STAT-201' AND comp.name IN ('Statistical Inference', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-DQA-101' AND comp.name IN ('Data Quality Assurance', 'Survey Design')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-CPI-101' AND comp.name IN ('Statistical Inference', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-NSS-101' AND comp.name IN ('Survey Design', 'Sampling Techniques', 'Data Quality Assurance')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-GDP-101' AND comp.name IN ('Statistical Inference', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

-- ─── Domain (Technical/Digital) ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-PY-101' AND comp.name = 'Python Programming'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-PY-201' AND comp.name IN ('Python Programming', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-SQL-101' AND comp.name = 'SQL & Database Management'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-R-101' AND comp.name IN ('R Programming', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-AI-101' AND comp.name IN ('Python Programming', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-DP-101' AND comp.name IN ('Data Privacy & Protection', 'Cybersecurity Awareness')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-CYBER-101' AND comp.name = 'Cybersecurity Awareness'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-DIG-101' AND comp.name = 'E-Governance Frameworks'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-GIS-101' AND comp.name IN ('Data Engineering', 'Cloud Computing')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-BNS-101' AND comp.name = 'Critical Thinking'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-BNSS-101' AND comp.name = 'Critical Thinking'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-OD-101' AND comp.name IN ('Open Data & Data Sharing', 'Data Privacy & Protection')
ON CONFLICT DO NOTHING;

-- ─── Mandatory (APAR-Linked) ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-APAR-101' AND comp.name = 'Project Management'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-ARC-101' AND comp.name IN ('Communication', 'Leadership')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-SEC-101' AND comp.name = 'Cybersecurity Awareness'
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-CC-101' AND comp.name IN ('Communication', 'E-Governance Frameworks')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-POSH-ADV' AND comp.name IN ('Leadership', 'Communication')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'IGOT-CCA-ADV' AND comp.name IN ('Leadership', 'Critical Thinking')
ON CONFLICT DO NOTHING;

-- ─── NSSTA TPAC courses ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'NSSTA-PRIV-201' AND comp.name IN ('Data Privacy & Protection', 'Cybersecurity Awareness')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'NSSTA-SURV-301' AND comp.name IN ('Survey Design', 'Sampling Techniques', 'Statistical Inference')
ON CONFLICT DO NOTHING;

-- ─── Internal courses ───
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.title = 'Python for Statistical Analysis' AND comp.name IN ('Python Programming', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.title = 'Advanced SQL for Data Analysis' AND comp.name = 'SQL & Database Management'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- INDIAN STATES AND UNION TERRITORIES
-- =============================================================================
INSERT INTO public.indian_states (name, code, is_ut) VALUES
  ('Andhra Pradesh', 'AP', false),
  ('Arunachal Pradesh', 'AR', false),
  ('Assam', 'AS', false),
  ('Bihar', 'BR', false),
  ('Chhattisgarh', 'CG', false),
  ('Goa', 'GA', false),
  ('Gujarat', 'GJ', false),
  ('Haryana', 'HR', false),
  ('Himachal Pradesh', 'HP', false),
  ('Jharkhand', 'JH', false),
  ('Karnataka', 'KA', false),
  ('Kerala', 'KL', false),
  ('Madhya Pradesh', 'MP', false),
  ('Maharashtra', 'MH', false),
  ('Manipur', 'MN', false),
  ('Meghalaya', 'ML', false),
  ('Mizoram', 'MZ', false),
  ('Nagaland', 'NL', false),
  ('Odisha', 'OD', false),
  ('Punjab', 'PB', false),
  ('Rajasthan', 'RJ', false),
  ('Sikkim', 'SK', false),
  ('Tamil Nadu', 'TN', false),
  ('Telangana', 'TS', false),
  ('Tripura', 'TR', false),
  ('Uttar Pradesh', 'UP', false),
  ('Uttarakhand', 'UK', false),
  ('West Bengal', 'WB', false),
  ('Andaman and Nicobar Islands', 'AN', true),
  ('Chandigarh', 'CH', true),
  ('Dadra and Nagar Haveli and Daman and Diu', 'DD', true),
  ('Delhi', 'DL', true),
  ('Jammu and Kashmir', 'JK', true),
  ('Ladakh', 'LA', true),
  ('Lakshadweep', 'LD', true),
  ('Puducherry', 'PY', true)
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- CENTRAL GOVERNMENT MINISTRIES
-- =============================================================================
INSERT INTO public.central_ministries (name, short_name) VALUES
  ('Ministry of Agriculture and Farmers Welfare', 'MoA'),
  ('Ministry of Ayush', 'MoAY'),
  ('Ministry of Chemicals and Fertilizers', 'MoCF'),
  ('Ministry of Civil Aviation', 'MoCA'),
  ('Ministry of Coal', 'MoC'),
  ('Ministry of Commerce and Industry', 'MoCI'),
  ('Ministry of Communications', 'MoCom'),
  ('Ministry of Consumer Affairs, Food and Public Distribution', 'MoCAFPD'),
  ('Ministry of Corporate Affairs', 'MoCorA'),
  ('Ministry of Culture', 'MoCul'),
  ('Ministry of Defence', 'MoD'),
  ('Ministry of Development of North Eastern Region', 'DoNER'),
  ('Ministry of Earth Sciences', 'MoES'),
  ('Ministry of Education', 'MoE'),
  ('Ministry of Electronics and Information Technology', 'MeitY'),
  ('Ministry of Environment, Forest and Climate Change', 'MoEFCC'),
  ('Ministry of External Affairs', 'MEA'),
  ('Ministry of Finance', 'MoF'),
  ('Ministry of Fisheries, Animal Husbandry and Dairying', 'MoFAHD'),
  ('Ministry of Food Processing Industries', 'MoFPI'),
  ('Ministry of Health and Family Welfare', 'MoHFW'),
  ('Ministry of Heavy Industries', 'MoHI'),
  ('Ministry of Home Affairs', 'MHA'),
  ('Ministry of Housing and Urban Affairs', 'MoHUA'),
  ('Ministry of Information and Broadcasting', 'MoI&B'),
  ('Ministry of Jal Shakti', 'MoJS'),
  ('Ministry of Labour and Employment', 'MoLE'),
  ('Ministry of Law and Justice', 'MoLJ'),
  ('Ministry of Micro, Small and Medium Enterprises', 'MoMSME'),
  ('Ministry of Mines', 'MoM'),
  ('Ministry of Minority Affairs', 'MoMA'),
  ('Ministry of New and Renewable Energy', 'MNRE'),
  ('Ministry of Panchayati Raj', 'MoPR'),
  ('Ministry of Parliamentary Affairs', 'MoPA'),
  ('Ministry of Personnel, Public Grievances and Pensions', 'DoPPW'),
  ('Ministry of Petroleum and Natural Gas', 'MoPNG'),
  ('Ministry of Pharmaceuticals', 'MoPh'),
  ('Ministry of Planning', 'MoP'),
  ('Ministry of Power', 'MoPwr'),
  ('Ministry of Railways', 'MoR'),
  ('Ministry of Road Transport and Highways', 'MoRTH'),
  ('Ministry of Rural Development', 'MoRD'),
  ('Ministry of Science and Technology', 'MoST'),
  ('Ministry of Shipping', 'MoS'),
  ('Ministry of Social Justice and Empowerment', 'MoSJE'),
  ('Ministry of Statistics and Programme Implementation', 'MoSPI'),
  ('Ministry of Steel', 'MoStl'),
  ('Ministry of Textiles', 'MoT'),
  ('Ministry of Tourism', 'MoTou'),
  ('Ministry of Tribal Affairs', 'MoTA'),
  ('Ministry of Women and Child Development', 'MoWCD'),
  ('Ministry of Youth Affairs and Sports', 'MoYAS'),
  ('NITI Aayog', 'NITI'),
  ('Prime Ministers Office', 'PMO'),
  ('Department of Space', 'DoS'),
  ('Department of Atomic Energy', 'DAE')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- SAMPLE ORGANISATIONS (Central Government)
-- =============================================================================
INSERT INTO public.organisations (name, ministry, org_type) VALUES
  ('Central Statistical Office', 'Ministry of Statistics and Programme Implementation', 'central'),
  ('National Sample Survey Office', 'Ministry of Statistics and Programme Implementation', 'central'),
  ('National Statistical Commission', 'Ministry of Statistics and Programme Implementation', 'central'),
  ('National Statistical System Training Academy', 'Ministry of Statistics and Programme Implementation', 'central'),
  ('Office of the Registrar General and Census Commissioner', 'Ministry of Home Affairs', 'central'),
  ('National Informatics Centre', 'Ministry of Electronics and Information Technology', 'central'),
  ('Electronics Corporation of India Limited', 'Ministry of Defence', 'psu'),
  ('National Institute of Smart Government', 'Ministry of Electronics and Information Technology', 'autonomous'),
  ('Central Electricity Authority', 'Ministry of Power', 'central'),
  ('Central Water Commission', 'Ministry of Jal Shakti', 'central'),
  ('Survey of India', 'Ministry of Science and Technology', 'central'),
  ('Geological Survey of India', 'Ministry of Mines', 'central'),
  ('Indian Meteorological Department', 'Ministry of Earth Sciences', 'central'),
  ('National Remote Sensing Centre', 'Department of Space', 'central'),
  ('Indian Space Research Organisation', 'Department of Space', 'autonomous'),
  ('National Centre for Geo-informatics', 'Ministry of Statistics and Programme Implementation', 'central'),
  ('Data Analytics Division', 'NITI Aayog', 'central'),
  ('National Database for Emergency Communications', 'Ministry of Home Affairs', 'central'),
  ('Centralised Public Grievance Redress and Monitoring System', 'Ministry of Personnel, Public Grievances and Pensions', 'central'),
  ('Unique Identification Authority of India', 'Ministry of Electronics and Information Technology', 'autonomous')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- SAMPLE ORGANISATIONS (State Government)
-- =============================================================================
INSERT INTO public.organisations (name, state, org_type) VALUES
  ('Directorate of Statistics', 'Maharashtra', 'state'),
  ('State Planning Board', 'Karnataka', 'state'),
  ('Bureau of Economics and Statistics', 'Tamil Nadu', 'state'),
  ('Department of Planning', 'Gujarat', 'state'),
  ('State Institute of Rural Development', 'Rajasthan', 'state'),
  ('Directorate of Economics and Statistics', 'Uttar Pradesh', 'state'),
  ('Kerala State Planning Board', 'Kerala', 'state'),
  ('Odisha State Planning Board', 'Odisha', 'state')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DESIGNATIONS
-- =============================================================================
INSERT INTO public.designations (name, level) VALUES
  ('Under Secretary', 'entry'),
  ('Assistant Director', 'entry'),
  ('Statistical Officer', 'entry'),
  ('Section Officer', 'entry'),
  ('Assistant Director General', 'entry'),
  ('Deputy Secretary', 'mid'),
  ('Joint Director', 'mid'),
  ('Senior Statistical Officer', 'mid'),
  ('Deputy Director General', 'mid'),
  ('Director', 'senior'),
  ('Chief Statistical Officer', 'senior'),
  ('Additional Secretary', 'senior'),
  ('Joint Secretary', 'senior'),
  ('Secretary', 'executive'),
  ('Director General', 'executive'),
  ('Chief Secretary', 'executive'),
  ('Additional Director General', 'executive'),
  ('Vice Chairman', 'executive')
ON CONFLICT (name) DO NOTHING;
