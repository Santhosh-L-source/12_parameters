-- Migration: GATE / Placement Exam Evidence Table
-- Module: GATE / Placement Exam (25 marks)
-- Scoring: Core tiers (3/5/10/15/20/25) computed from fields + optional bonus (+3 or +5)
-- Verification: Single mentor, manual

-- Drop tables if exist (for clean migration)
DROP TABLE IF EXISTS gate_exam_evidence CASCADE;
DROP TABLE IF EXISTS gate_branch_calibration CASCADE;

-- Create gate_branch_calibration table (lookup table for 25-mark tier)
CREATE TABLE gate_branch_calibration (
  id SERIAL PRIMARY KEY,
  branch TEXT NOT NULL,
  year INTEGER NOT NULL,
  threshold_score DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch, year)
);

-- Seed with PLACEHOLDER data (to be replaced with real branch thresholds later)
INSERT INTO gate_branch_calibration (branch, year, threshold_score)
VALUES ('CSE', 2026, 500.00);

COMMENT ON TABLE gate_branch_calibration IS '⚠️ PLACEHOLDER DATA - Replace with actual branch-specific GATE score thresholds';
COMMENT ON COLUMN gate_branch_calibration.threshold_score IS 'Minimum GATE score required for 25-mark tier in this branch/year';

-- Create gate_exam_evidence table
CREATE TABLE gate_exam_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Distinct key: exam_type + exam_year (student can have multiple exams)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  -- Exam details
  exam_type TEXT NOT NULL CHECK (
    exam_type IN ('GATE', 'GRE', 'GMAT', 'CAT', 'TOEFL', 'IELTS', 'PTE')
  ),
  exam_year INTEGER,

  -- Computable fields for core GATE achievement (all optional for bonus-only submissions)
  tests_completed INTEGER DEFAULT 0,
  full_length_tests INTEGER DEFAULT 0,
  average_score_percent DECIMAL(5,2),
  diagnostic_completed BOOLEAN DEFAULT FALSE,
  official_appearance BOOLEAN DEFAULT FALSE,
  qualified BOOLEAN DEFAULT FALSE,
  gate_score DECIMAL(5,2),
  branch_code TEXT,

  -- Bonus exam flag (GRE/GMAT/CAT/TOEFL/IELTS/PTE)
  is_bonus_exam BOOLEAN DEFAULT FALSE,

  certificate_url TEXT,

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (student_id, distinct_key_normalized)
);

-- Create indexes for performance
CREATE INDEX idx_gate_student ON gate_exam_evidence(student_id);
CREATE INDEX idx_gate_status ON gate_exam_evidence(status);
CREATE INDEX idx_gate_mentor ON gate_exam_evidence(mentor_id);
CREATE INDEX idx_gate_exam_type ON gate_exam_evidence(exam_type);
CREATE INDEX idx_gate_is_bonus ON gate_exam_evidence(is_bonus_exam);

-- Add audit trigger for gate_exam_evidence
CREATE OR REPLACE FUNCTION update_gate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gate_updated_at
  BEFORE UPDATE ON gate_exam_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_gate_timestamp();

-- Add audit trigger for gate_branch_calibration
CREATE OR REPLACE FUNCTION update_gate_calibration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gate_calibration_updated_at
  BEFORE UPDATE ON gate_branch_calibration
  FOR EACH ROW
  EXECUTE FUNCTION update_gate_calibration_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON gate_exam_evidence TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON gate_branch_calibration TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE gate_exam_evidence_id_seq TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE gate_branch_calibration_id_seq TO PUBLIC;

COMMENT ON TABLE gate_exam_evidence IS 'GATE and placement exam evidence with computed core tiers + optional bonus';
COMMENT ON COLUMN gate_exam_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN gate_exam_evidence.mentor_id IS 'FK to profiles.id_number (MENTOR_N format)';
COMMENT ON COLUMN gate_exam_evidence.is_bonus_exam IS 'TRUE for GRE/GMAT/CAT/TOEFL/IELTS/PTE (bonus only if core >= 5)';
COMMENT ON COLUMN gate_exam_evidence.tests_completed IS 'Total practice tests completed (for core tier calculation)';
COMMENT ON COLUMN gate_exam_evidence.full_length_tests IS 'Full-length mock tests completed (for 15-mark tier)';
COMMENT ON COLUMN gate_exam_evidence.average_score_percent IS 'Average score across tests (for 10/15-mark tiers)';
COMMENT ON COLUMN gate_exam_evidence.diagnostic_completed IS 'Initial diagnostic test completed (for 3-mark tier)';
COMMENT ON COLUMN gate_exam_evidence.official_appearance IS 'Appeared in official exam (15-mark tier)';
COMMENT ON COLUMN gate_exam_evidence.qualified IS 'Qualified in exam (20-mark tier)';
COMMENT ON COLUMN gate_exam_evidence.gate_score IS 'Actual GATE score (for 25-mark tier with branch calibration)';
COMMENT ON COLUMN gate_exam_evidence.branch_code IS 'Student branch code (for branch-calibrated scoring)';
