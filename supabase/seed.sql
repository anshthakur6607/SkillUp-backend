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
-- COURSES — Real iGOT Karmayogi Courses
-- =============================================================================
-- Source: iGOT Karmayogi portal (https://igotkarmayogi.gov.in)
-- IDs fetched from the Sunbird content API (real course IDs)
-- Duration in seconds from iGOT, converted to hours for our schema.
-- =============================================================================

INSERT INTO public.courses (title, description, source, external_id, external_url, duration_hours) VALUES
  (
    'AI Using Google Bard and ChatGPT for Beginners',
    'Comprehensive introduction to generative AI through Google Bard and ChatGPT. Learn to draft emails, generate ideas, create content, analyze data with Code Interpreter, and understand privacy and ethical considerations when using AI tools in government operations.',
    'igot',
    'do_113923174474121216195',
    'https://portal.igotkarmayogi.gov.in/public/toc/do_113923174474121216195/overview',
    0.42
  ),
  (
    'Training Module on Swachata Hi Seva - 2024',
    'Comprehensive overview of the Swachhata Hi Seva (SHS) 2024 campaign. Covers the theme Swabhav Swachhata - Sanskaar Swachhata, promoting cleanliness as a natural habit and cultural value across government offices.',
    'igot',
    'do_1141533540853432321675',
    'https://portal.igotkarmayogi.gov.in/public/toc/do_1141533540853432321675/overview',
    0.33
  ),
  (
    'Civil Defence Services',
    'Detailed understanding of the civil defence framework in India. Covers how civil defence organisations respond during emergencies, disasters, and wartime situations to protect citizens and critical infrastructure.',
    'igot',
    'do_1143166853070028801812',
    'https://portal.igotkarmayogi.gov.in/public/toc/do_1143166853070028801812/overview',
    1.28
  ),
  (
    'Fire Safety in Healthcare Facilities',
    'Fire safety challenges in healthcare settings — vulnerable patients, high-value equipment, and combustible materials. Covers prevention, evacuation protocols, and compliance with fire safety regulations.',
    'igot',
    'do_1143052789530787841562',
    'https://portal.igotkarmayogi.gov.in/public/toc/do_1143052789530787841562/overview',
    1.38
  ),
  (
    'Prevention of Sexual Harassment of Women at Workplace',
    'Mandatory course educating all employees on preventing sexual harassment. Covers the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013, ICC procedures, and reporting mechanisms.',
    'igot',
    'do_113569878939262976132',
    'https://portal.igotkarmayogi.gov.in/public/toc/do_113569878939262976132/overview',
    1.87
  )
ON CONFLICT (source, external_id) DO NOTHING;

-- =============================================================================
-- COURSE-COMPETENCY MAPPINGS
-- Maps each real iGOT course to the competencies it addresses.
-- =============================================================================

-- AI Using Google Bard and ChatGPT for Beginners
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'do_113923174474121216195' AND comp.name IN ('Python Programming', 'Data Analysis & Interpretation')
ON CONFLICT DO NOTHING;

-- Swachata Hi Seva - 2024
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'do_1141533540853432321675' AND comp.name IN ('Collaboration', 'Communication')
ON CONFLICT DO NOTHING;

-- Civil Defence Services
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'do_1143166853070028801812' AND comp.name IN ('Critical Thinking', 'Leadership')
ON CONFLICT DO NOTHING;

-- Fire Safety in Healthcare Facilities
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'do_1143052789530787841562' AND comp.name IN ('Critical Thinking', 'Project Management')
ON CONFLICT DO NOTHING;

-- Prevention of Sexual Harassment of Women at Workplace
INSERT INTO public.course_competencies (course_id, competency_id)
SELECT c.id, comp.id FROM public.courses c, public.competencies comp
WHERE c.external_id = 'do_113569878939262976132' AND comp.name IN ('Communication', 'Collaboration')
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
