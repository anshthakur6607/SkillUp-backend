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
ON CONFLICT (name) DO NOTHIN
ON CONFLICT (name) DO NOTHING;
