-- Migration: Aptitude & Communication Evidence Table
-- Module: Aptitude & Communication (20 marks total)
--
-- APTITUDE (max 15 marks): Based on PERCENTILE from aptitude tests
--   - Test completed (no percentile floor) = 3 marks
--   - 60-69th percentile = 6 marks
--   - 70-79th percentile = 9 marks
--   - 80-89th percentile = 12 marks
--   - 90+ percentile = 15 marks
--   Logic: Take SINGLE BEST percentile result
--
-- COMMUNICATION (max 5 marks): Based on scorecard/threshold
--   - Has valid scorecard = 3 marks
--   - Meets central threshold = 5 marks
--   Logic: Take BEST result (5 if threshold met, else 3 if scorecard exists)
--
-- Total: Sum best aptitude + best communication, cap at 20
-- NOT event-based, NOT accumulative across multiple submissions

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS aptitude_communication_evidence CASCADE;

-- Create aptitude_communication_evidence table
CREATE TABLE aptitude_communication_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Category: APTITUDE or COMMUNICATION
  evidence_category TEXT NOT NULL CHECK (evidence_category IN ('APTITUDE', 'COMMUNICATION')),

  -- APTITUDE fields
  percentile DECIMAL(5,2),  -- NULL if not applicable
  test_completed BOOLEAN DEFAULT FALSE,  -- TRUE = completed (tier 3), FALSE = no test taken
  test_name TEXT,  -- Optional: name of aptitude test (TCS CodeVita, etc.)
  test_date DATE,

  -- COMMUNICATION fields
  has_valid_scorecard BOOLEAN DEFAULT FALSE,  -- TRUE = tier 3
  meets_central_threshold BOOLEAN DEFAULT FALSE,  -- TRUE = tier 5 (overrides scorecard)
  event_description TEXT,  -- Optional: description of communication event
  event_date DATE,

  -- Common fields
  certificate_url TEXT,
  remarks TEXT,

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Category-specific validation (strengthened to prevent cross-contamination)
  CHECK (
    (evidence_category = 'APTITUDE'
     AND test_completed = TRUE
     AND has_valid_scorecard = FALSE
     AND meets_central_threshold = FALSE)
    OR
    (evidence_category = 'COMMUNICATION'
     AND test_completed = FALSE
     AND percentile IS NULL
     AND (has_valid_scorecard = TRUE OR meets_central_threshold = TRUE))
  )
);

-- Create indexes for performance
CREATE INDEX idx_aptitude_communication_student ON aptitude_communication_evidence(student_id);
CREATE INDEX idx_aptitude_communication_category ON aptitude_communication_evidence(evidence_category);
CREATE INDEX idx_aptitude_communication_status ON aptitude_communication_evidence(status);
CREATE INDEX idx_aptitude_communication_mentor ON aptitude_communication_evidence(mentor_id);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_aptitude_communication_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aptitude_communication_updated_at
  BEFORE UPDATE ON aptitude_communication_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_aptitude_communication_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON aptitude_communication_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE aptitude_communication_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE aptitude_communication_evidence IS 'Aptitude & Communication evidence - best aptitude + best communication, capped at 20';
COMMENT ON COLUMN aptitude_communication_evidence.evidence_category IS 'APTITUDE or COMMUNICATION';
COMMENT ON COLUMN aptitude_communication_evidence.percentile IS 'For APTITUDE: percentile (60-69=6, 70-79=9, 80-89=12, 90+=15)';
COMMENT ON COLUMN aptitude_communication_evidence.test_completed IS 'For APTITUDE: test completed = 3 marks baseline';
COMMENT ON COLUMN aptitude_communication_evidence.has_valid_scorecard IS 'For COMMUNICATION: valid scorecard = 3 marks';
COMMENT ON COLUMN aptitude_communication_evidence.meets_central_threshold IS 'For COMMUNICATION: central threshold = 5 marks';
