-- =============================================================================
-- Seed: departments_lookup — sub-departments under ministries
-- Run AFTER migration 0008 and after seed.sql
-- =============================================================================

-- MoSPI departments
INSERT INTO public.departments_lookup (name, ministry) VALUES
  ('National Sample Survey Office (NSSO) - Field Operations Division', 'Ministry of Statistics and Programme Implementation'),
  ('National Sample Survey Office (NSSO) - Survey Design & Research Division', 'Ministry of Statistics and Programme Implementation'),
  ('Central Statistical Office (CSO) - National Accounts Division', 'Ministry of Statistics and Programme Implementation'),
  ('Central Statistical Office (CSO) - Social Statistics Division', 'Ministry of Statistics and Programme Implementation'),
  ('Central Statistical Office (CSO) - Economic Statistics Division', 'Ministry of Statistics and Programme Implementation'),
  ('National Statistical Commission - Research Unit', 'Ministry of Statistics and Programme Implementation'),
  ('NSSTA - Training & Capacity Building', 'Ministry of Statistics and Programme Implementation'),
  ('Data Analytics Division', 'Ministry of Statistics and Programme Implementation'),
  ('National Centre for Geo-informatics (NCoG)', 'Ministry of Statistics and Programme Implementation')
ON CONFLICT DO NOTHING;

-- MeitY departments
INSERT INTO public.departments_lookup (name, ministry) VALUES
  ('National Informatics Centre (NIC)', 'Ministry of Electronics and Information Technology'),
  ('Electronics Governance Division', 'Ministry of Electronics and Information Technology'),
  ('Data Governance & Analytics Group', 'Ministry of Electronics and Information Technology'),
  ('Cybersecurity Division', 'Ministry of Electronics and Information Technology'),
  ('Digital India Division', 'Ministry of Electronics and Information Technology')
ON CONFLICT DO NOTHING;

-- MoF departments
INSERT INTO public.departments_lookup (name, ministry) VALUES
  ('Department of Economic Affairs', 'Ministry of Finance'),
  ('Department of Revenue', 'Ministry of Finance'),
  ('Department of Expenditure', 'Ministry of Finance'),
  ('Department of Financial Services', 'Ministry of Finance'),
  ('Department of Investment & Asset Management', 'Ministry of Finance')
ON CONFLICT DO NOTHING;

-- Education departments
INSERT INTO public.departments_lookup (name, ministry) VALUES
  ('Department of Higher Education', 'Ministry of Education'),
  ('Department of School Education & Literacy', 'Ministry of Education'),
  ('University Grants Commission (UGC)', 'Ministry of Education'),
  ('National Testing Agency (NTA)', 'Ministry of Education')
ON CONFLICT DO NOTHING;

-- MoSPI state departments
INSERT INTO public.departments_lookup (name, state) VALUES
  ('Directorate of Economics and Statistics', 'Maharashtra'),
  ('Bureau of Economics and Statistics', 'Tamil Nadu'),
  ('State Planning Board - Statistics Division', 'Karnataka'),
  ('Directorate of Statistics', 'Gujarat'),
  ('Department of Planning - Statistics Wing', 'Rajasthan'),
  ('State Bureau of Statistics and Programme Implementation', 'Uttar Pradesh'),
  ('Kerala State Planning Board - Statistics Division', 'Kerala'),
  ('Planning & Statistics Department', 'Odisha')
ON CONFLICT DO NOTHING;
