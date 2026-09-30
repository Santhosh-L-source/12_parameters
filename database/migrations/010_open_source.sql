-- Migration: Open Source Contributions Evidence Table
-- Module: Open Source (20 marks)
--
-- Scoring: Group by distinct_key_normalized (repo/programme),
--          MAX stage per repo, SUM across repos, cap at 20
--
-- Stages (per repo):
--   3 marks:  1 PR submitted (not merged)
--   5 marks:  1 PR merged
--   10 marks: 3 PRs merged
--   15 marks: 5+ PRs merged
--   17 marks: Selected in approved open source programme (GSoC, Outreachy, MLH, etc.)
--   20 marks: Maintainer status or programme completion

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS open_source_evidence CASCADE;

-- Create open_source_evidence table
CREATE TABLE open_source_evidence (
  id SERIAL PRIMARY KEY,

  -- FK to profiles (single source of truth)
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,

  -- Repository/Programme identification
  github_username TEXT NOT NULL,
  repo_name TEXT,  -- e.g. "kubernetes/kubernetes" or NULL for programme-only submissions
  programme_name TEXT,  -- e.g. "GSoC 2024", "Outreachy Round 57", NULL for repo-only

  -- Distinct key: repo OR programme name (one row per repo/programme student contributes to)
  distinct_key TEXT NOT NULL,  -- Format: repo_name OR programme_name
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,

  -- Contribution metrics
  prs_submitted INTEGER DEFAULT 0 CHECK (prs_submitted >= 0),
  prs_merged INTEGER DEFAULT 0 CHECK (prs_merged >= 0 AND prs_merged <= prs_submitted),

  -- Programme/Maintainer status
  programme_selected BOOLEAN DEFAULT FALSE,  -- Selected in approved programme
  is_maintainer BOOLEAN DEFAULT FALSE,  -- Maintainer status
  programme_completed BOOLEAN DEFAULT FALSE,  -- Programme completion

  -- Auto-fetch metadata (GitHub REST API: api.github.com/search/issues?q=is:pr+author:username+repo:owner/repo)
  fetch_method TEXT DEFAULT 'MANUAL' CHECK (fetch_method IN ('MANUAL', 'GITHUB_API', 'MANUAL_VERIFICATION')),
  fetch_status TEXT,  -- Success/error details from auto-fetch
  last_fetched_at TIMESTAMPTZ,

  -- URLs for verification
  repo_url TEXT,  -- GitHub repo URL
  programme_url TEXT,  -- Programme participation proof URL
  evidence_urls TEXT[],  -- Array of PR URLs, maintainer proof links, etc.

  -- Single mentor verification
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,

  remarks TEXT,  -- Additional context (e.g. "Core contributor to TypeScript compiler")

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one submission per student per repo/programme
  UNIQUE (student_id, distinct_key_normalized),

  -- At least one of repo_name or programme_name must be present
  CHECK (repo_name IS NOT NULL OR programme_name IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX idx_open_source_student ON open_source_evidence(student_id);
CREATE INDEX idx_open_source_status ON open_source_evidence(status);
CREATE INDEX idx_open_source_mentor ON open_source_evidence(mentor_id);
CREATE INDEX idx_open_source_repo ON open_source_evidence(repo_name);
CREATE INDEX idx_open_source_programme ON open_source_evidence(programme_name);

-- Add audit trigger
CREATE OR REPLACE FUNCTION update_open_source_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER open_source_updated_at
  BEFORE UPDATE ON open_source_evidence
  FOR EACH ROW
  EXECUTE FUNCTION update_open_source_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON open_source_evidence TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE open_source_evidence_id_seq TO PUBLIC;

COMMENT ON TABLE open_source_evidence IS 'Open source contributions - MAX stage per repo, SUM across repos (cap 20)';
COMMENT ON COLUMN open_source_evidence.student_id IS 'FK to profiles.id_number';
COMMENT ON COLUMN open_source_evidence.distinct_key IS 'repo_name OR programme_name - one row per contribution target';
COMMENT ON COLUMN open_source_evidence.prs_submitted IS 'Total PRs submitted to this repo (includes merged + unmerged)';
COMMENT ON COLUMN open_source_evidence.prs_merged IS 'Total PRs merged in this repo';
COMMENT ON COLUMN open_source_evidence.programme_selected IS 'Selected in approved open source programme (GSoC, Outreachy, MLH)';
COMMENT ON COLUMN open_source_evidence.is_maintainer IS 'Maintainer status in this repo';
COMMENT ON COLUMN open_source_evidence.programme_completed IS 'Successfully completed programme';
COMMENT ON COLUMN open_source_evidence.fetch_method IS 'MANUAL, GITHUB_API (api.github.com/search/issues), or MANUAL_VERIFICATION';
