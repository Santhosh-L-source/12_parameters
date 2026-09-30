-- Migration: Certificate Achievement Evidence Table
-- Module: Certificate Achievement (20 marks)
-- Scoring: Same credential → highest tier only, sum distinct credentials, foundation sub-cap 10, overall cap 20
-- Verification: Platform-assisted (verify_url) or mentor manual

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS certificate_evidence CASCADE;

-- Create certificate_evidence table
CREATE TABLE certificate_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Distinct key: credential name ONLY (no date, no tier)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  credential_name TEXT NOT NULL,
  credential_category TEXT NOT NULL CHECK (credential_category IN ('ACADEMIC', 'INDUSTRY')),

  -- Tier depends on category
  tier_level TEXT NOT NULL,
  tier_marks INTEGER NOT NULL,

  -- Platform-assisted verification
  verify_url TEXT,  -- Credly/NPTEL/Coursera URL for auto-check
  credential_id TEXT,  -- Platform credential ID

  -- Foundation-level flag (set by mentor/admin at verification, NOT by student)
  -- PLACEHOLDER: No default list yet, manually set during verification
  is_foundation_level BOOLEAN DEFAULT FALSE,

  -- Details
  issuing_organization TEXT,
  issue_date DATE,
  expiry_date DATE,

  certificate_url TEXT,

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL' CHECK (verification_source IN ('PLATFORM_PARTIAL', 'MENTOR_MANUAL')),
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (student_id, distinct_key_normalized),

  -- Category-specific tier validation
  CHECK (
    (credential_category = 'ACADEMIC' AND tier_marks IN (3, 5, 10, 15))
    OR
    (credential_category = 'INDUSTRY' AND tier_marks IN (5, 10, 15))
  )
);

-- Create indexes for performance
CREATE INDEX idx_certificate_student ON certificate_evidence(student_id);
CREATE INDEX idx_certificate_status ON certificate_evidence(status);
CREATE INDEX idx_certificate_mentor ON certificate_evidence(mentor_id);
CREATE INDEX idx_certificate_category ON certificate_evidence(credential_category);
CREATE INDEX idx_certificate_foundation ON certificate_evidence(is_foundation_level);
CREATE INDEX idx_certificate_verification_source ON certificate_evidence(verification_source);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_certificate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER certificate_updated_at
  BEFORE UPDATE ON certificate_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_certificate_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON certificate_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE certificate_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE certificate_evidence IS 'Certificate/credential evidence - same credential highest tier, foundation sub-cap 10, overall cap 20';
COMMENT ON COLUMN certificate_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN certificate_evidence.mentor_id IS 'FK to profiles.id_number (MENTOR_N format)';
COMMENT ON COLUMN certificate_evidence.distinct_key IS 'Credential name ONLY (no date, no tier) - prevents duplicate credentials';
COMMENT ON COLUMN certificate_evidence.credential_category IS 'ACADEMIC (3/5/10/15) or INDUSTRY (5/10/15)';
COMMENT ON COLUMN certificate_evidence.tier_marks IS 'Academic: 3/5/10/15, Industry: 5/10/15';
COMMENT ON COLUMN certificate_evidence.is_foundation_level IS 'PLACEHOLDER - manually set during verification until real list provided. Foundation credentials sub-capped at 10 marks within overall 20 cap';
COMMENT ON COLUMN certificate_evidence.verification_source IS 'PLATFORM_PARTIAL (with verify_url) or MENTOR_MANUAL';
COMMENT ON COLUMN certificate_evidence.verify_url IS 'Credly/NPTEL/Coursera URL for platform-assisted verification';
