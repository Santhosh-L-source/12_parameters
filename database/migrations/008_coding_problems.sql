-- Migration: Coding Problems Evidence Table
-- Module: Coding Problems (25 marks)
-- Scoring: SUM total_solved and sql_solved across ALL verified platforms, then check tiers
-- Tiers (both conditions must be met):
--   200 total + 20 SQL → 5 marks
--   350 total + 30 SQL → 10 marks
--   550 total + 45 SQL → 15 marks
--   750 total + 60 SQL → 20 marks
--   1000 total + 75 SQL → 25 marks

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS coding_problems_evidence CASCADE;

-- Create coding_problems_evidence table
CREATE TABLE coding_problems_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Platform identification
  platform TEXT NOT NULL,  -- LEETCODE, HACKERRANK, SKILLRACK, CODECHEF, etc.
  username TEXT NOT NULL,

  -- Distinct key: platform + username (prevents duplicate platform submissions)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  -- Problem counts (both required)
  total_solved INTEGER NOT NULL CHECK (total_solved >= 0),
  sql_solved INTEGER NOT NULL CHECK (sql_solved >= 0 AND sql_solved <= total_solved),

  -- Auto-fetch metadata
  fetch_method TEXT DEFAULT 'MANUAL' CHECK (fetch_method IN ('MANUAL', 'GRAPHQL', 'SCRAPER')),
  fetch_status TEXT,  -- Success/error details from auto-fetch
  last_fetched_at TIMESTAMPTZ,

  -- Profile URL for verification
  profile_url TEXT,

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one submission per student per platform+username
  UNIQUE (student_id, distinct_key_normalized)
);

-- Create indexes for performance
CREATE INDEX idx_coding_problems_student ON coding_problems_evidence(student_id);
CREATE INDEX idx_coding_problems_status ON coding_problems_evidence(status);
CREATE INDEX idx_coding_problems_mentor ON coding_problems_evidence(mentor_id);
CREATE INDEX idx_coding_problems_platform ON coding_problems_evidence(platform);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_coding_problems_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coding_problems_updated_at
  BEFORE UPDATE ON coding_problems_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_coding_problems_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON coding_problems_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE coding_problems_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE coding_problems_evidence IS 'Coding problems evidence - SUM across platforms, tier check on totals';
COMMENT ON COLUMN coding_problems_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN coding_problems_evidence.distinct_key IS 'platform+username - prevents duplicate submissions for same platform';
COMMENT ON COLUMN coding_problems_evidence.total_solved IS 'Total problems solved (all difficulties)';
COMMENT ON COLUMN coding_problems_evidence.sql_solved IS 'SQL problems solved (subset of total)';
COMMENT ON COLUMN coding_problems_evidence.fetch_method IS 'MANUAL, GRAPHQL (LeetCode), or SCRAPER (others)';
