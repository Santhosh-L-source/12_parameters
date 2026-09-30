-- Add missing columns to students table for login system
ALTER TABLE students ADD COLUMN IF NOT EXISTS register_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS college TEXT;
