-- Migration: Hundred Days Training Evidence Table
-- Module: 100 Days Training (15 marks)
-- Description: One-time lookup for PEP/HOPE training selection

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS hundred_days_evidence CASCADE;

-- Create hundred_days_evidence table
-- NOTE: Using students(roll_number) FK until profiles table migration is complete
CREATE TABLE hundred_days_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(roll_number) ON DELETE RESTRICT,

  -- No distinct_key - only ONE record per student

  training_program TEXT NOT NULL CHECK (
    training_program IN ('PEP', 'HOPE_NON_ELITE', 'HOPE_ELITE', 'NOT_SELECTED')
  ),
  selection_year INTEGER,

  selection_letter_url TEXT,

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id INTEGER REFERENCES mentors(id),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (student_id)
);

-- Create indexes for performance
CREATE INDEX idx_hundred_days_student ON hundred_days_evidence(student_id);
CREATE INDEX idx_hundred_days_status ON hundred_days_evidence(status);
CREATE INDEX idx_hundred_days_mentor ON hundred_days_evidence(mentor_id);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_hundred_days_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hundred_days_updated_at
  BEFORE UPDATE ON hundred_days_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_hundred_days_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON hundred_days_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE hundred_days_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE hundred_days_evidence IS 'Stores 100 Days Training program selection evidence (PEP/HOPE)';
COMMENT ON COLUMN hundred_days_evidence.training_program IS 'PEP=5 marks, HOPE_NON_ELITE=10 marks, HOPE_ELITE=15 marks';
COMMENT ON COLUMN hundred_days_evidence.student_id IS 'FK to students.roll_number (will migrate to profiles.id_number later)';
