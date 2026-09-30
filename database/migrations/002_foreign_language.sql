-- Migration: Foreign Language Evidence Table
-- Module: Foreign Language (15 marks)
-- Scoring: A1=7, A2=12, B1=15 (MAX across languages, NOT sum)
-- Verification: Single mentor, manual

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS language_evidence CASCADE;

-- Create language_evidence table
CREATE TABLE language_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Distinct key: language + proficiency_level
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  -- Language details
  language TEXT NOT NULL CHECK (lower(trim(language)) != 'english'),  -- Case-insensitive English rejection
  proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('A1', 'A2', 'B1')),

  certification_name TEXT,
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
CREATE INDEX idx_language_student ON language_evidence(student_id);
CREATE INDEX idx_language_status ON language_evidence(status);
CREATE INDEX idx_language_mentor ON language_evidence(mentor_id);
CREATE INDEX idx_language_level ON language_evidence(proficiency_level);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_language_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER language_updated_at
  BEFORE UPDATE ON language_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_language_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON language_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE language_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE language_evidence IS 'Foreign language proficiency evidence - excludes English';
COMMENT ON COLUMN language_evidence.language IS 'Language name (English rejected case-insensitively)';
COMMENT ON COLUMN language_evidence.proficiency_level IS 'CEFR levels: A1=7 marks, A2=12 marks, B1=15 marks';
COMMENT ON COLUMN language_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN language_evidence.mentor_id IS 'FK to profiles.id_number (MENTOR_N format)';
COMMENT ON CONSTRAINT language_evidence_language_check ON language_evidence IS 'Rejects "english" in any case (English, ENGLISH, english, etc.)';
