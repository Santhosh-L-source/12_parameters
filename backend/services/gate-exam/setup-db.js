#!/usr/bin/env node
/**
 * One-time database setup — creates the two GATE module tables in Supabase.
 * Run once: node setup-db.js
 */
'use strict';

require('dotenv').config();
const { Client } = require('pg');

const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
const password = process.env.SUPABASE_SECRET_KEY;

const SQL = `
CREATE TABLE IF NOT EXISTS gate_evidence (
  id                          SERIAL PRIMARY KEY,
  student_id                  INTEGER NOT NULL,
  semester_id                 INTEGER NOT NULL,
  diagnostic_completed        BOOLEAN NOT NULL DEFAULT false,
  tests_completed             INTEGER NOT NULL DEFAULT 0,
  full_length_tests_completed INTEGER NOT NULL DEFAULT 0,
  average_score_percent       DECIMAL(5,2) NOT NULL DEFAULT 0,
  official_appearance         BOOLEAN NOT NULL DEFAULT false,
  qualified                   BOOLEAN NOT NULL DEFAULT false,
  gate_score                  INTEGER,
  branch_code                 VARCHAR(20) NOT NULL,
  optional_exam_type          VARCHAR(10) CHECK (optional_exam_type IN ('GRE','GMAT','CAT','TOEFL','IELTS','PTE')),
  optional_scorecard_valid    BOOLEAN NOT NULL DEFAULT false,
  central_threshold_met       BOOLEAN NOT NULL DEFAULT false,
  proof_url                   TEXT,
  status                      VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  mentor_id                   INTEGER,
  verified_at                 TIMESTAMPTZ,
  core_tier                   INTEGER,
  bonus                       INTEGER,
  final_score                 INTEGER,
  flag_missing_calibration    BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gate_branch_calibration (
  id                     SERIAL PRIMARY KEY,
  branch_code            VARCHAR(20) NOT NULL,
  min_qualifying_score   INTEGER NOT NULL,
  min_score_for_25_marks INTEGER NOT NULL,
  effective_from         DATE NOT NULL,
  effective_to           DATE,
  updated_by             INTEGER NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_branch_date
  ON gate_branch_calibration (branch_code, effective_from DESC);

ALTER TABLE gate_evidence           DISABLE ROW LEVEL SECURITY;
ALTER TABLE gate_branch_calibration DISABLE ROW LEVEL SECURITY;
`;

// Supabase exposes PostgreSQL directly; try both the direct host and the session pooler
const CONFIGS = [
  // Direct connection
  { host: `db.${ref}.supabase.co`,                     port: 5432, user: 'postgres',         password, database: 'postgres', ssl: { rejectUnauthorized: false } },
  // Session pooler (newer Supabase architecture)
  { host: `aws-0-ap-south-1.pooler.supabase.com`,      port: 5432, user: `postgres.${ref}`,  password, database: 'postgres', ssl: { rejectUnauthorized: false } },
  { host: `aws-0-us-east-1.pooler.supabase.com`,       port: 5432, user: `postgres.${ref}`,  password, database: 'postgres', ssl: { rejectUnauthorized: false } },
  { host: `aws-0-us-west-1.pooler.supabase.com`,       port: 5432, user: `postgres.${ref}`,  password, database: 'postgres', ssl: { rejectUnauthorized: false } },
  { host: `aws-0-eu-central-1.pooler.supabase.com`,    port: 5432, user: `postgres.${ref}`,  password, database: 'postgres', ssl: { rejectUnauthorized: false } },
];

async function tryConnect(config) {
  const client = new Client({ ...config, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    console.log(`Connected via ${config.host}`);
    await client.query(SQL);
    console.log('Tables created successfully!');
    await client.end();
    return true;
  } catch (err) {
    try { await client.end(); } catch {}
    return false;
  }
}

async function main() {
  console.log(`Setting up tables for project: ${ref}\n`);

  for (const cfg of CONFIGS) {
    process.stdout.write(`Trying ${cfg.host}... `);
    const ok = await tryConnect(cfg);
    if (ok) {
      console.log('\nDone. Start the server with:  npm start');
      process.exit(0);
    } else {
      console.log('failed');
    }
  }

  // All attempts failed — guide the user to the dashboard
  console.log('\nCould not connect directly. Please run the schema manually:');
  console.log(`\n  1. Open: https://supabase.com/dashboard/project/${ref}/sql/new`);
  console.log('  2. Paste the contents of  supabase/schema.sql');
  console.log('  3. Click Run');
  console.log('\nThen start the server:  npm start\n');
  process.exit(1);
}

main();
