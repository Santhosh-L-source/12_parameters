-- Migration: CP Rating Evidence Table
-- Module: CP Rating (20 marks)
--
-- ⚠️ PLACEHOLDER TIERS — AWAITING REAL CUTOFFS FROM USER
-- Current tiers use PLACEHOLDER values:
--   Codeforces: 1200/1400/1600/1800 for 5/10/15/20
--   CodeChef: 1400/1600/1800/2000 for 5/10/15/20
--   LeetCode Contest: 1400/1600/1800/2000 for 5/10/15/20
--
-- Scoring: SINGLE BEST rating across all verified platforms (not SUM)
-- Rating must be current/recent (auto-fetch validates recency)

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS cp_rating_evidence CASCADE;

-- Create cp_rating_evidence table
CREATE TABLE cp_rating_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Platform identification
  platform TEXT NOT NULL CHECK (platform IN ('CODEFORCES', 'CODECHEF', 'LEETCODE_CONTEST')),
  username TEXT NOT NULL,

  -- Distinct key: platform + username (prevents duplicate platform submissions)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  -- Current rating (must be recent, not all-time peak)
  current_rating INTEGER NOT NULL CHECK (current_rating >= 0),

  -- Auto-fetch metadata (rating changes frequently, needs refresh)
  fetch_method TEXT DEFAULT 'MANUAL' CHECK (fetch_method IN ('MANUAL', 'API', 'SCRAPER')),
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

  -- Unique constraint: one submission per student per platform
  UNIQUE (student_id, distinct_key_normalized)
);

-- Create indexes for performance
CREATE INDEX idx_cp_rating_student ON cp_rating_evidence(student_id);
CREATE INDEX idx_cp_rating_status ON cp_rating_evidence(status);
CREATE INDEX idx_cp_rating_mentor ON cp_rating_evidence(mentor_id);
CREATE INDEX idx_cp_rating_platform ON cp_rating_evidence(platform);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_cp_rating_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cp_rating_updated_at
  BEFORE UPDATE ON cp_rating_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_cp_rating_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON cp_rating_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE cp_rating_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE cp_rating_evidence IS 'CP rating evidence - SINGLE BEST rating across platforms';
COMMENT ON COLUMN cp_rating_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN cp_rating_evidence.distinct_key IS 'platform+username - prevents duplicate submissions for same platform';
COMMENT ON COLUMN cp_rating_evidence.current_rating IS 'Current rating (not all-time peak) - must be recent';
COMMENT ON COLUMN cp_rating_evidence.fetch_method IS 'MANUAL, API (Codeforces/CodeChef), or SCRAPER (LeetCode Contest)';

-- Create parameter_tiers table if not exists
CREATE TABLE IF NOT EXISTS parameter_tiers (
  id SERIAL PRIMARY KEY,
  parameter TEXT NOT NULL,
  platform TEXT NOT NULL,
  tier_name TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  marks INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (parameter, platform, threshold)
);

CREATE INDEX IF NOT EXISTS idx_parameter_tiers_lookup ON parameter_tiers(parameter, platform, threshold DESC);

GRANT SELECT, INSERT, UPDATE ON parameter_tiers TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE parameter_tiers_id_seq TO PUBLIC;

-- Seed placeholder rating tiers (WILL BE REPLACED with real values from user)
DELETE FROM parameter_tiers WHERE parameter = 'cp_rating';

INSERT INTO parameter_tiers (parameter, platform, tier_name, threshold, marks, metadata, created_at)
VALUES
  -- ⚠️ CODEFORCES PLACEHOLDER TIERS
  ('cp_rating', 'CODEFORCES', 'Expert', 1800, 20, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'CODEFORCES', 'Specialist', 1600, 15, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'CODEFORCES', 'Pupil', 1400, 10, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'CODEFORCES', 'Newbie', 1200, 5, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),

  -- ⚠️ CODECHEF PLACEHOLDER TIERS
  ('cp_rating', 'CODECHEF', '5 Star', 2000, 20, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'CODECHEF', '4 Star', 1800, 15, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'CODECHEF', '3 Star', 1600, 10, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'CODECHEF', '2 Star', 1400, 5, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),

  -- ⚠️ LEETCODE CONTEST PLACEHOLDER TIERS
  ('cp_rating', 'LEETCODE_CONTEST', 'Knight', 2000, 20, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'LEETCODE_CONTEST', 'Guardian', 1800, 15, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'LEETCODE_CONTEST', 'Intermediate', 1600, 10, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW()),
  ('cp_rating', 'LEETCODE_CONTEST', 'Beginner', 1400, 5, '{"placeholder": true, "note": "AWAITING REAL CUTOFFS"}', NOW());

COMMENT ON TABLE parameter_tiers IS 'Rating tier thresholds — Module 9 uses PLACEHOLDER values until user provides real cutoffs';
