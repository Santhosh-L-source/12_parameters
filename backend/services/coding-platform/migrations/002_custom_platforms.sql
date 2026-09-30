-- Migration 002: Support custom platforms
-- Run this in Supabase SQL Editor

-- Step 1: Convert status column from ENUM to VARCHAR
-- (Required so Sequelize alter:true can manage the column)
ALTER TABLE coding_evidence
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE coding_evidence
  ALTER COLUMN status TYPE VARCHAR(20) USING status::text;

ALTER TABLE coding_evidence
  ALTER COLUMN status SET DEFAULT 'PENDING';

-- Drop the old enum type
DROP TYPE IF EXISTS "public"."enum_coding_evidence_status";

-- Step 2: Widen the platform column to accept custom platform keys
ALTER TABLE coding_evidence
  ALTER COLUMN platform TYPE VARCHAR(100);

-- Step 3: Add platform_label column for custom platform display names
ALTER TABLE coding_evidence
  ADD COLUMN IF NOT EXISTS platform_label VARCHAR(255);

-- Step 4: Drop the old ENUM constraint on platform if it exists
-- (Supabase may have created it from the original schema)
DO $$
BEGIN
  ALTER TABLE coding_evidence
    ALTER COLUMN platform TYPE VARCHAR(100);
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Verify the changes
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'coding_evidence'
ORDER BY ordinal_position;
