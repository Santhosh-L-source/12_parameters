-- Migration: Create profiles table as single source of truth
-- Replaces: students(roll_number) and mentors(id) as FK targets
-- Purpose: Unified people table with id_number as canonical identifier

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table
CREATE TABLE profiles (
  id_number TEXT PRIMARY KEY,  -- roll_number for students, unique ID for mentors/admin

  -- Person type
  role TEXT NOT NULL CHECK (role IN ('student', 'mentor', 'admin')),

  -- Common fields
  name TEXT NOT NULL,
  email TEXT,

  -- Student-specific (NULL for mentors/admin)
  register_number TEXT,
  department TEXT,
  college TEXT,

  -- Auth
  password_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_register_number ON profiles(register_number);

-- Migrate existing students to profiles
INSERT INTO profiles (id_number, role, name, email, register_number, department, college, password_hash, created_at, updated_at)
SELECT
  roll_number as id_number,
  'student' as role,
  name,
  email,
  register_number,
  department,
  college,
  COALESCE(password_hash, password) as password_hash,
  created_at,
  updated_at
FROM students
ON CONFLICT (id_number) DO NOTHING;

-- Migrate existing mentors to profiles
INSERT INTO profiles (id_number, role, name, email, password_hash, created_at, updated_at)
SELECT
  'MENTOR_' || id::TEXT as id_number,
  'mentor' as role,
  name,
  email,
  password_hash,
  created_at,
  updated_at
FROM mentors
ON CONFLICT (id_number) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON profiles TO PUBLIC;

-- Add update trigger
CREATE OR REPLACE FUNCTION update_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_timestamp();

COMMENT ON TABLE profiles IS 'Unified people table - single source of truth for students, mentors, and admins';
COMMENT ON COLUMN profiles.id_number IS 'Primary identifier: roll_number for students, MENTOR_N for mentors';
