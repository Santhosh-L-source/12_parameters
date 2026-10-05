-- ============================================================================
-- HOPE 12-PARAMETERS PLATFORM — COMPLETE HIERARCHICAL DATABASE SCHEMA
-- Primary Key across all user roles & evidence tables: roll_number
-- File: database/queries/COMPLETE_SCHEMA.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USER ROLES & ACCESS HIERARCHY
-- ============================================================================

-- 1. ADMINS (Highest Level: Oversight of Mentors, Students, and Parameters)
CREATE TABLE IF NOT EXISTS admins (
  roll_number VARCHAR(50) PRIMARY KEY, -- e.g. 'ADM001'
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100) DEFAULT 'ALL',
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MENTORS (Mid Level: Linked to Admin, Guides Students, Evaluates Parameters)
CREATE TABLE IF NOT EXISTS mentors (
  roll_number VARCHAR(50) PRIMARY KEY, -- e.g. 'MTR101'
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'mentor',
  admin_roll_number VARCHAR(50),       -- Admin overseeing this mentor
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_mentors_admin
    FOREIGN KEY (admin_roll_number)
    REFERENCES admins(roll_number)
    ON DELETE SET NULL
);

-- 3. STUDENTS (Base Level: Linked to Mentor & Admin, Submits to 12 Parameters)
CREATE TABLE IF NOT EXISTS students (
  roll_number VARCHAR(50) PRIMARY KEY, -- e.g. '24CS422'
  register_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  department VARCHAR(100) NOT NULL,
  section VARCHAR(20),
  batch VARCHAR(20),
  year_of_study INTEGER,
  mentor_roll_number VARCHAR(50),      -- Mentor guiding this student
  admin_roll_number VARCHAR(50),       -- Admin with global access
  role VARCHAR(50) NOT NULL DEFAULT 'student',
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_students_mentor
    FOREIGN KEY (mentor_roll_number)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL,

  CONSTRAINT fk_students_admin
    FOREIGN KEY (admin_roll_number)
    REFERENCES admins(roll_number)
    ON DELETE SET NULL
);

-- ============================================================================
-- 2. MASTER EVALUATION PARAMETERS & READINESS TIERS
-- ============================================================================

-- 4. The 12 Canonical Parameters
CREATE TABLE IF NOT EXISTS parameters (
  id TEXT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  max_marks INTEGER NOT NULL CHECK (max_marks >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Readiness Level Definitions
CREATE TABLE IF NOT EXISTS level_thresholds (
  level_name VARCHAR(50) PRIMARY KEY,
  tier_rank INTEGER NOT NULL UNIQUE,
  min_marks NUMERIC(5,2) NOT NULL,
  requires_condition BOOLEAN NOT NULL DEFAULT true,
  description TEXT
);

-- 6. GATE Branch Cutoff Calibrations
CREATE TABLE IF NOT EXISTS gate_branch_calibration (
  id SERIAL PRIMARY KEY,
  branch TEXT NOT NULL,
  year INTEGER NOT NULL,
  threshold_score NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_gate_branch_year UNIQUE (branch, year)
);

-- ============================================================================
-- 3. MASTER PROFILES, SCORES & AUDITING
-- ============================================================================

-- 7. Master Student Readiness Profiles (1:1 with students)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  batch VARCHAR(20),
  section VARCHAR(20),
  total_score NUMERIC(5,2) DEFAULT 0,
  coding_score NUMERIC(5,2) DEFAULT 0,
  level VARCHAR(50) DEFAULT 'NOT_ELIGIBLE',
  readiness_status VARCHAR(50) DEFAULT 'Developing',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_profiles_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE
);

-- 8. Scores Table (Normalized marks per parameter per student per semester)
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  parameter_id TEXT NOT NULL,
  marks NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (marks >= 0),
  semester INTEGER NOT NULL DEFAULT 1 CHECK (semester BETWEEN 1 AND 8),
  provisional BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_scores_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_scores_parameter
    FOREIGN KEY (parameter_id)
    REFERENCES parameters(id)
    ON DELETE RESTRICT,

  CONSTRAINT uq_scores_student_param_sem
    UNIQUE (roll_number, parameter_id, semester)
);

-- 9. Student Computed Level History
CREATE TABLE IF NOT EXISTS student_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  semester INTEGER NOT NULL DEFAULT 1 CHECK (semester BETWEEN 1 AND 8),
  total_marks NUMERIC(5,2) NOT NULL DEFAULT 0,
  level_name VARCHAR(50) NOT NULL,
  level_condition_met BOOLEAN NOT NULL DEFAULT false,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_student_levels_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_student_levels_threshold
    FOREIGN KEY (level_name)
    REFERENCES level_thresholds(level_name)
    ON DELETE RESTRICT,

  CONSTRAINT uq_student_levels_sem
    UNIQUE (roll_number, semester)
);

-- 10. Audit Trail Log (Accountability for Admin & Mentor changes)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  actor_roll_number VARCHAR(50) NOT NULL,
  actor_role VARCHAR(50) NOT NULL CHECK (actor_role IN ('student', 'mentor', 'admin')),
  action VARCHAR(100) NOT NULL,
  parameter_id TEXT,
  previous_marks NUMERIC(5,2),
  new_marks NUMERIC(5,2),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_audit_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE RESTRICT,

  CONSTRAINT fk_audit_parameter
    FOREIGN KEY (parameter_id)
    REFERENCES parameters(id)
    ON DELETE RESTRICT
);

-- ============================================================================
-- 4. THE 12 MODULE EVIDENCE TABLES (All Linked to students.roll_number)
-- ============================================================================

-- 01. Coding Problems Evidence
CREATE TABLE IF NOT EXISTS coding_problems_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  username VARCHAR(100) NOT NULL,
  distinct_key VARCHAR(150),
  distinct_key_normalized VARCHAR(150) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  total_solved INTEGER DEFAULT 0,
  sql_solved INTEGER DEFAULT 0,
  profile_url TEXT,
  fetch_method VARCHAR(50) DEFAULT 'SCRAPER',
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ,

  CONSTRAINT fk_coding_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_coding_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 02. Competitive Programming Rating Evidence
CREATE TABLE IF NOT EXISTS cp_rating_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  handle VARCHAR(100) NOT NULL,
  distinct_key VARCHAR(150),
  distinct_key_normalized VARCHAR(150) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  current_rating INTEGER DEFAULT 0,
  max_rating INTEGER DEFAULT 0,
  profile_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_cp_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_cp_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 03. Open Source Contributions Evidence
CREATE TABLE IF NOT EXISTS open_source_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  github_username VARCHAR(100) NOT NULL,
  repo_name VARCHAR(255),
  distinct_key VARCHAR(255),
  distinct_key_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  prs_submitted INTEGER DEFAULT 0,
  prs_merged INTEGER DEFAULT 0,
  is_maintainer BOOLEAN DEFAULT false,
  programme_selected BOOLEAN DEFAULT false,
  programme_completed BOOLEAN DEFAULT false,
  repo_url TEXT,
  evidence_urls TEXT[],
  fetch_method VARCHAR(50) DEFAULT 'GITHUB_API',
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ,

  CONSTRAINT fk_opensource_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_opensource_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 04. Monthly Coding Assessment Evidence
CREATE TABLE IF NOT EXISTS monthly_coding_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  contest_name VARCHAR(255) NOT NULL,
  score NUMERIC(5,2) DEFAULT 0,
  rank INTEGER,
  percentile NUMERIC(5,2),
  semester INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'VERIFIED',
  assessed_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_monthly_coding_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE
);

-- 05. 100 Days Training Evidence
CREATE TABLE IF NOT EXISTS hundred_days_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  programme_type VARCHAR(50) NOT NULL, -- 'PEP' or 'HOPE'
  days_completed INTEGER DEFAULT 0,
  total_days INTEGER DEFAULT 100,
  badge_earned VARCHAR(100),
  status VARCHAR(50) DEFAULT 'VERIFIED',
  evaluated_by_mentor_roll VARCHAR(50),
  completed_at TIMESTAMPTZ,

  CONSTRAINT fk_hundred_days_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_hundred_days_mentor
    FOREIGN KEY (evaluated_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 06. GATE / Placement Exam Evidence
CREATE TABLE IF NOT EXISTS gate_exam_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  distinct_key VARCHAR(150),
  distinct_key_normalized VARCHAR(150) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  exam_type VARCHAR(50) NOT NULL,
  exam_year INTEGER,
  tests_completed INTEGER DEFAULT 0,
  full_length_tests INTEGER DEFAULT 0,
  average_score_percent NUMERIC(5,2),
  diagnostic_completed BOOLEAN DEFAULT false,
  official_appearance BOOLEAN DEFAULT false,
  qualified BOOLEAN DEFAULT false,
  gate_score NUMERIC(5,2),
  branch_code VARCHAR(50),
  is_bonus_exam BOOLEAN DEFAULT false,
  certificate_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_gate_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_gate_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 07. Foreign Language Evidence
CREATE TABLE IF NOT EXISTS language_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  distinct_key VARCHAR(150),
  distinct_key_normalized VARCHAR(150) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  language VARCHAR(50) NOT NULL,
  certification_level VARCHAR(50) NOT NULL,
  certificate_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_language_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_language_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 08. Internship & Startup Evidence
CREATE TABLE IF NOT EXISTS internship_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  distinct_key VARCHAR(255),
  distinct_key_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  company_name VARCHAR(255) NOT NULL,
  role VARCHAR(100),
  duration_months INTEGER DEFAULT 1,
  monthly_stipend NUMERIC(10,2) DEFAULT 0,
  is_startup BOOLEAN DEFAULT false,
  offer_letter_url TEXT,
  completion_certificate_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_internship_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_internship_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 09. Competition Evidence
CREATE TABLE IF NOT EXISTS competition_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  distinct_key VARCHAR(255),
  distinct_key_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  competition_name VARCHAR(255) NOT NULL,
  level VARCHAR(50),
  position VARCHAR(50),
  certificate_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_competition_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_competition_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 10. Certificate Achievement Evidence
CREATE TABLE IF NOT EXISTS certificate_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  distinct_key VARCHAR(255),
  distinct_key_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  certificate_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('ACADEMIC', 'INDUSTRY')),
  issuing_body VARCHAR(100),
  grade_or_score VARCHAR(50),
  certificate_url TEXT,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_certificate_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_certificate_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- 11. Aptitude & Communication Evidence
CREATE TABLE IF NOT EXISTS aptitude_communication_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  quant_score NUMERIC(5,2) DEFAULT 0,
  logical_score NUMERIC(5,2) DEFAULT 0,
  verbal_score NUMERIC(5,2) DEFAULT 0,
  communication_level VARCHAR(50),
  assessment_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'VERIFIED',

  CONSTRAINT fk_aptitude_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE
);

-- 12. Project / Publication / Patent Evidence
CREATE TABLE IF NOT EXISTS project_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number VARCHAR(50) NOT NULL,
  distinct_key VARCHAR(255),
  distinct_key_normalized VARCHAR(255) GENERATED ALWAYS AS (LOWER(TRIM(distinct_key))) STORED,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('CAPSTONE', 'PATENT', 'PUBLICATION')),
  description TEXT,
  github_repo_url TEXT,
  live_demo_url TEXT,
  paper_doi_or_patent_no VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by_mentor_roll VARCHAR(50),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  CONSTRAINT fk_project_student
    FOREIGN KEY (roll_number)
    REFERENCES students(roll_number)
    ON DELETE CASCADE,

  CONSTRAINT fk_project_mentor
    FOREIGN KEY (verified_by_mentor_roll)
    REFERENCES mentors(roll_number)
    ON DELETE SET NULL
);

-- ============================================================================
-- 5. INITIAL SEED DATA
-- ============================================================================

INSERT INTO parameters (id, name, max_marks, description) VALUES
  ('coding_problems', 'Coding Problems', 25, 'LeetCode, Codeforces, HackerRank - SQL/DSA problems'),
  ('cp_rating', 'Competitive Programming Rating', 20, 'Codeforces, CodeChef, LeetCode ratings'),
  ('opensource', 'Open Source Contributions', 20, 'GitHub PRs, open source programs'),
  ('competition', 'Competitions', 20, 'Hackathons, contests, competitive events'),
  ('internship', 'Internship & Startup', 20, 'Professional experience, startup work'),
  ('project', 'Project / Publication / Patent', 30, 'Academic/professional outputs'),
  ('language', 'Foreign Language', 15, 'Language proficiency certifications'),
  ('gate', 'GATE / Placement Exam', 25, 'GATE, GRE, or other entrance exams'),
  ('monthly_coding', 'Monthly Coding Assessment', 20, 'Internal monthly assessments'),
  ('hundred_days', '100 Days Training', 15, 'PEP, HOPE training completion'),
  ('aptitude', 'Aptitude & Communication', 20, 'Aptitude tests, communication skills'),
  ('certificate', 'Certificate Achievement', 20, 'Academic/industry certifications')
ON CONFLICT (id) DO NOTHING;

INSERT INTO level_thresholds (level_name, tier_rank, min_marks, requires_condition, description) VALUES
  ('Level 1', 1, 50.0, false, 'Foundation readiness (no prerequisite)'),
  ('Level 2', 2, 75.0, true,  'Developing readiness (requires monthly_coding >= 15 OR gate >= 15)'),
  ('Level 3', 3, 100.0, true, 'Proficient readiness (requires monthly_coding >= 15 OR gate >= 15)'),
  ('Level 4', 4, 130.0, true, 'Advanced readiness (requires monthly_coding >= 15 OR gate >= 15)'),
  ('Level 5', 5, 160.0, true, 'Expert readiness (requires monthly_coding >= 15 OR gate >= 15)')
ON CONFLICT (level_name) DO NOTHING;

INSERT INTO gate_branch_calibration (branch, year, threshold_score) VALUES
  ('CSE', 2026, 500.00),
  ('IT', 2026, 480.00),
  ('ECE', 2026, 450.00)
ON CONFLICT (branch, year) DO NOTHING;

-- Default Admin
INSERT INTO admins (roll_number, name, email, department, role) VALUES
  ('ADM001', 'System Administrator', 'admin@hope.edu', 'ALL', 'admin')
ON CONFLICT (roll_number) DO NOTHING;

-- ============================================================================
-- 6. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_students_mentor ON students(mentor_roll_number);
CREATE INDEX IF NOT EXISTS idx_scores_student_sem ON scores(roll_number, semester);
CREATE INDEX IF NOT EXISTS idx_coding_evidence_student ON coding_problems_evidence(roll_number);
CREATE INDEX IF NOT EXISTS idx_opensource_evidence_student ON open_source_evidence(roll_number);
CREATE INDEX IF NOT EXISTS idx_audit_student ON audit_log(roll_number);
