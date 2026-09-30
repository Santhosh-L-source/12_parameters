-- Migration: Competition Achievement Evidence Table
-- Module: Competition Achievement (20 marks)
-- Scoring: Same event → highest round only, sum distinct events, cap 20
-- Verification: Single mentor, manual

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS competition_evidence CASCADE;

-- Create competition_evidence table
CREATE TABLE competition_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Distinct key: event name (NOT event name + date)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  -- Event details
  event_name TEXT NOT NULL,
  competition_type TEXT,
  organizer TEXT,
  event_date DATE,

  -- Round cleared (NOT rank/position)
  round_cleared TEXT NOT NULL CHECK (
    round_cleared IN (
      'VALID_COMPLETION',      -- 2 marks
      'PRELIM',                -- 4 marks
      'SECOND_ROUND',          -- 6 marks
      'REGIONAL_FINALIST',     -- 10 marks
      'NATIONAL_FINALIST',     -- 15 marks
      'INTERNATIONAL_WINNER'   -- 20 marks
    )
  ),
  stage_marks INTEGER NOT NULL CHECK (stage_marks IN (2, 4, 6, 10, 15, 20)),

  certificate_url TEXT,
  proof_url TEXT,

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
CREATE INDEX idx_competition_student ON competition_evidence(student_id);
CREATE INDEX idx_competition_status ON competition_evidence(status);
CREATE INDEX idx_competition_mentor ON competition_evidence(mentor_id);
CREATE INDEX idx_competition_round ON competition_evidence(round_cleared);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_competition_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER competition_updated_at
  BEFORE UPDATE ON competition_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_competition_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON competition_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE competition_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE competition_evidence IS 'Competition/hackathon achievement evidence - same event highest round only';
COMMENT ON COLUMN competition_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN competition_evidence.mentor_id IS 'FK to profiles.id_number (MENTOR_N format)';
COMMENT ON COLUMN competition_evidence.distinct_key IS 'Event name ONLY (no date) - allows updating to higher rounds';
COMMENT ON COLUMN competition_evidence.round_cleared IS 'Highest round cleared (not rank/position)';
COMMENT ON COLUMN competition_evidence.stage_marks IS 'Marks for this round: 2/4/6/10/15/20';
