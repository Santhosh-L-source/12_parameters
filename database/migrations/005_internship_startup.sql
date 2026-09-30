-- Migration: Internship & Startup Evidence Table
-- Module: Internship & Startup (20 marks)
-- Scoring: Same company → highest stage only, sum across BOTH tracks, cap 20 (not 20 per track)
-- Verification: Single mentor, manual

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS internship_evidence CASCADE;

-- Create internship_evidence table
CREATE TABLE internship_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Distinct key: company/startup name ONLY (no date, no track)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  company_name TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('RECRUITMENT', 'STARTUP')),

  -- Stage depends on track
  achievement_stage TEXT NOT NULL,
  stage_marks INTEGER NOT NULL,

  -- Details
  role TEXT,
  start_date DATE,
  end_date DATE,
  duration_months INTEGER,

  offer_letter_url TEXT,
  completion_certificate_url TEXT,

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (student_id, distinct_key_normalized),

  -- Track-specific stage validation
  CHECK (
    (track = 'RECRUITMENT' AND achievement_stage IN (
      'APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'JOINED', 'COMPLETED'
    ) AND stage_marks IN (2, 4, 6, 10, 15, 20))
    OR
    (track = 'STARTUP' AND achievement_stage IN (
      'IDEATION', 'PROTOTYPE', 'REGISTERED', 'FUNDED_SEED', 'REVENUE', 'SCALED'
    ) AND stage_marks IN (3, 5, 8, 10, 15, 20))
  )
);

-- Create indexes for performance
CREATE INDEX idx_internship_student ON internship_evidence(student_id);
CREATE INDEX idx_internship_status ON internship_evidence(status);
CREATE INDEX idx_internship_mentor ON internship_evidence(mentor_id);
CREATE INDEX idx_internship_track ON internship_evidence(track);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_internship_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER internship_updated_at
  BEFORE UPDATE ON internship_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_internship_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON internship_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE internship_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE internship_evidence IS 'Internship & startup evidence - same company highest stage, sum across both tracks, cap 20 total';
COMMENT ON COLUMN internship_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN internship_evidence.mentor_id IS 'FK to profiles.id_number (MENTOR_N format)';
COMMENT ON COLUMN internship_evidence.distinct_key IS 'Company/startup name ONLY (no date, no track) - prevents duplicate company names';
COMMENT ON COLUMN internship_evidence.track IS 'RECRUITMENT (interview process) or STARTUP (own venture)';
COMMENT ON COLUMN internship_evidence.stage_marks IS 'Recruitment: 2/4/6/10/15/20, Startup: 3/5/8/10/15/20';
