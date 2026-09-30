-- Hope Project - Initial Schema Migration for Supabase
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on roll_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);

-- Coding Evidence table
CREATE TABLE IF NOT EXISTS coding_evidence (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL,
    semester INTEGER NOT NULL,
    platform VARCHAR(100) NOT NULL,
    platform_label VARCHAR(255),
    profile_url TEXT NOT NULL,
    total_problems_solved INTEGER DEFAULT 0,
    sql_problems_solved INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    fetched_at TIMESTAMP WITH TIME ZONE,
    mentor_id VARCHAR(50),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified BOOLEAN DEFAULT FALSE,
    external_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Composite unique constraint
    UNIQUE(student_id, platform)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coding_evidence_student_id ON coding_evidence(student_id);
CREATE INDEX IF NOT EXISTS idx_coding_evidence_platform ON coding_evidence(platform);
CREATE INDEX IF NOT EXISTS idx_coding_evidence_status ON coding_evidence(status);
CREATE INDEX IF NOT EXISTS idx_coding_evidence_student_platform ON coding_evidence(student_id, platform);

-- Verification Attempts table
CREATE TABLE IF NOT EXISTS verification_attempts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    profile_url TEXT NOT NULL,
    external_username VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for verification attempts
CREATE INDEX IF NOT EXISTS idx_verification_student_id ON verification_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_verification_platform ON verification_attempts(platform);
CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_attempts(status);
CREATE INDEX IF NOT EXISTS idx_verification_student_platform ON verification_attempts(student_id, platform);
CREATE INDEX IF NOT EXISTS idx_verification_created_at ON verification_attempts(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coding_evidence_updated_at ON coding_evidence;
CREATE TRIGGER update_coding_evidence_updated_at
    BEFORE UPDATE ON coding_evidence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verification_attempts_updated_at ON verification_attempts;
CREATE TRIGGER update_verification_attempts_updated_at
    BEFORE UPDATE ON verification_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - remove if not needed)
-- INSERT INTO students (roll_number, name, email, password_hash) VALUES
-- ('24CS422', 'Sample Student', 'sample@example.com', '$2b$12$samplehashedpassword');

-- Grant necessary permissions (adjust based on your Supabase setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
