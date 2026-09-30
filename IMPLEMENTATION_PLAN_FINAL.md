# HOPE PROJECT - FINAL Implementation Plan (CORRECTED v3)

> **STATUS**: Awaiting approval - DO NOT IMPLEMENT  
> **ALL CORRECTIONS APPLIED**: 
> - ✅ Category 1: profiles.id_number as single source of truth
> - ✅ Category 2: Original scoring specifications (no invented formulas)
> - ✅ Category 3: Single mentor verification workflow across ALL modules (no HOD, no second approver)
> - ✅ Fix 1: GATE module - Replaced enum with computable fields, scoring queries gate_branch_calibration
> - ✅ Fix 2: Aptitude module - Added test_completed field, tier-3 no longer requires percentile >= 50
> - ✅ Fix 3: Foreign Language - Case-insensitive English check (lower(trim(language)) != 'english')
> - ✅ Fix 4: Monthly Coding - Added CHECK (percentage BETWEEN 0 AND 100)

---

## 📊 CURRENT STATE (Verified)

### ✅ Already Built
- Authentication system (JWT, 2,328 students)
- Student dashboard APIs
- Project/Publication/Patent module (30 marks, fully functional)
- Clean UI with backend integration
- Database: parameters, scores, audit_log, profiles tables

---

## 🎯 MODULES TO BUILD (10 Remaining)

### **STRUCTURAL PATTERN (All Modules)**

```sql
-- Canonical evidence table structure
CREATE TABLE {module}_evidence (
  id SERIAL PRIMARY KEY,
  
  -- Single source of truth for people
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- For accumulative modules
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  -- Module-specific columns here
  
  -- Single mentor verification (no HOD)
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

---

## 🔐 VERIFICATION WORKFLOW (All Modules)

### ✅ CONFIRMED: Single Mentor Approval Only

**ALL modules use ONE mentor verification** - no HOD, no second approver, no dual-stage approval anywhere.

```
Student submits → PENDING → Mentor reviews → VERIFIED or REJECTED
```

**No second-approver columns exist in ANY table:**
- ❌ NO `mentor_2_id`
- ❌ NO `hod_id`
- ❌ NO `hod_status`
- ❌ NO `final_approver`

### Verification Sources by Module

#### 1. **Pure Manual Verification** (`verification_source = 'MENTOR_MANUAL'`)
Mentor reviews uploaded proof documents and makes the decision:
- **Foreign Language**: Reviews language certificate
- **Internship & Startup**: Reviews offer letters, completion certificates
- **Competition Achievement**: Reviews competition certificates, proof
- **GATE / Placement Exam**: Reviews exam score cards, admit cards
- **Aptitude & Communication**: Reviews test scorecards, certificates
- **Hundred Days Training**: Reviews PEP/HOPE selection letter

**Flow**: Student submits proof → Mentor reviews document → Approve/Reject

---

#### 2. **Auto-fetch with Manual Override** (`verification_source = 'AUTO_FETCH'`)
System attempts automatic fetch, mentor can review/override:
- **Coding Problems**: Fetch from LeetCode/Codeforces/HackerRank APIs
- **CP Rating**: Fetch rating from platform APIs
- **Open Source**: Fetch GitHub contribution stats

**Flow**: Student submits username → Auto-fetch stats → Auto-set to VERIFIED (mentor can review/reject later)

---

#### 3. **Platform-Assisted Verification** (`verification_source = 'PLATFORM_PARTIAL'`)
**Certificate Achievement ONLY**

**Auto-check runs BEFORE mentor sees it** - result is an INPUT to mentor decision:

```javascript
// Certificate submission flow
1. Student submits certificate details + verify_url (if issuer provides one)
   - Credly badge URL
   - NPTEL certificate lookup link
   - Coursera accomplishment page
   
2. Backend auto-check (runs immediately on submission):
   - Fetches verify_url
   - Validates certificate is real
   - Checks name/date match
   - Stores result in auto_check_result column:
     * 'MATCHED' - certificate verified, details match
     * 'NOT_MATCHED' - certificate found but details don't match
     * 'NO_VERIFY_LINK' - issuer doesn't provide verification URL
     * 'NOT_CHECKED' - auto-check failed/skipped
   
3. Mentor review screen shows:
   - Certificate proof (uploaded image/PDF)
   - Auto-check result badge
   - All certificate details
   
4. Mentor makes FINAL decision: VERIFIED or REJECTED
   - Auto-check is guidance, NOT automatic approval
   - Mentor can reject even if MATCHED
   - Mentor can approve even if NOT_MATCHED (if proof is valid)
```

**Still single approval** - the auto-check assists the mentor, doesn't replace them.

---

## MODULE 1: Coding Problems (25 marks)

### Database Schema
```sql
CREATE TABLE coding_problems_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- Distinct key: platform + username
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  platform TEXT NOT NULL CHECK (platform IN ('LEETCODE', 'CODEFORCES', 'HACKERRANK')),
  username TEXT NOT NULL,
  profile_url TEXT,
  
  -- Required metrics
  total_solved INTEGER DEFAULT 0 NOT NULL,
  sql_solved INTEGER DEFAULT 0 NOT NULL,
  
  -- Optional breakdown
  easy_solved INTEGER DEFAULT 0,
  medium_solved INTEGER DEFAULT 0,
  hard_solved INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'AUTO_FETCH',
  rejection_reason TEXT,
  
  last_fetched TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Tiers based on BOTH total_solved AND sql_solved
 * BOTH conditions must hold, highest tier wins
 * NO continuous formulas, NO weighting
 */
function calculateCodingProblemsMarks(allPlatforms) {
  // Sum across all platforms
  const totalSolved = allPlatforms.reduce((sum, p) => sum + p.total_solved, 0);
  const sqlSolved = allPlatforms.reduce((sum, p) => sum + p.sql_solved, 0);
  
  // Tier thresholds - BOTH must be met
  if (totalSolved >= 1000 && sqlSolved >= 75) return 25;
  if (totalSolved >= 750 && sqlSolved >= 60) return 20;
  if (totalSolved >= 550 && sqlSolved >= 45) return 15;
  if (totalSolved >= 350 && sqlSolved >= 30) return 10;
  if (totalSolved >= 200 && sqlSolved >= 20) return 5;
  return 0;
}
```

### APIs
- `POST /api/coding-problems/submit-profile`
- `POST /api/coding-problems/fetch-stats`
- `GET /api/coding-problems/student/:id`
- `POST /api/coding-problems/:id/verify`

---

## MODULE 2: CP Rating (20 marks)

### Database Schema
```sql
CREATE TABLE cp_rating_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  platform TEXT NOT NULL CHECK (platform IN ('CODEFORCES', 'CODECHEF', 'LEETCODE')),
  username TEXT NOT NULL,
  
  current_rating INTEGER,
  max_rating INTEGER,
  rank TEXT,
  contests_participated INTEGER,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'AUTO_FETCH',
  rejection_reason TEXT,
  
  last_fetched TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);

-- Configuration table for platform-specific thresholds
CREATE TABLE parameter_tiers (
  id SERIAL PRIMARY KEY,
  parameter_id TEXT NOT NULL REFERENCES parameters(id),
  platform TEXT,
  tier_marks INTEGER NOT NULL,
  threshold_value INTEGER NOT NULL,
  description TEXT,
  UNIQUE (parameter_id, platform, tier_marks)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Single ascending tier: 5/10/15/20 marks
 * Cutoffs stored in parameter_tiers table per platform
 * DO NOT hardcode - query from config
 */
async function calculateCPRatingMarks(studentId) {
  // Get all platform ratings for student
  const ratings = await db.query(`
    SELECT platform, max_rating 
    FROM cp_rating_evidence 
    WHERE student_id = $1 AND status = 'VERIFIED'
  `, [studentId]);
  
  let bestMarks = 0;
  
  for (const rating of ratings) {
    // Query tier config for this platform
    const tiers = await db.query(`
      SELECT tier_marks, threshold_value
      FROM parameter_tiers
      WHERE parameter_id = 'cp_rating' 
        AND platform = $1
      ORDER BY threshold_value DESC
    `, [rating.platform]);
    
    // Find highest tier met
    for (const tier of tiers) {
      if (rating.max_rating >= tier.threshold_value) {
        bestMarks = Math.max(bestMarks, tier.tier_marks);
        break;
      }
    }
  }
  
  return bestMarks;
}
```

**⚠️ TODO**: Ask user for actual rating cutoffs before populating parameter_tiers

---

## MODULE 3: Open Source (20 marks)

### Database Schema
```sql
CREATE TABLE opensource_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- distinct_key = repo/programme name (NOT github_username)
  -- Student can have multiple rows (one per repo)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  repo_name TEXT NOT NULL,  -- The actual repo/programme name
  github_username TEXT,     -- For reference only
  repo_url TEXT,
  
  -- Stage for this repo
  achievement_stage TEXT NOT NULL CHECK (
    achievement_stage IN (
      'CONTRIBUTION',      -- 3 marks
      'REGULAR_CONTRIBUTOR', -- 5 marks
      'CORE_CONTRIBUTOR',   -- 10 marks
      'MAINTAINER',         -- 15 marks
      'OWNER',              -- 17 marks
      'RECOGNIZED'          -- 20 marks (GSoC, MLH, etc)
    )
  ),
  stage_marks INTEGER NOT NULL CHECK (stage_marks IN (3, 5, 10, 15, 17, 20)),
  
  -- Metrics (optional)
  pull_requests INTEGER DEFAULT 0,
  issues_opened INTEGER DEFAULT 0,
  contributions INTEGER DEFAULT 0,
  
  proof_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  last_fetched TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Per-repo evidence rows
 * Group by distinct_key_normalized, MAX stage per group, SUM across groups, cap at 20
 */
async function calculateOpensourceMarks(studentId) {
  const result = await db.query(`
    SELECT 
      distinct_key_normalized,
      MAX(stage_marks) as max_stage_marks
    FROM opensource_evidence
    WHERE student_id = $1 
      AND status = 'VERIFIED'
    GROUP BY distinct_key_normalized
  `, [studentId]);
  
  const totalMarks = result.rows.reduce((sum, row) => sum + row.max_stage_marks, 0);
  return Math.min(20, totalMarks);
}
```

---

## MODULE 4: Competition Achievement (20 marks)

### Database Schema
```sql
CREATE TABLE competition_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- distinct_key = event name
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  event_name TEXT NOT NULL,






  
  competition_type TEXT,
  organizer TEXT,
  event_date DATE,
  
  -- Round cleared (NOT rank/position)
  round_cleared TEXT NOT NULL CHECK (
    round_cleared IN (
      'VALID_COMPLETION',      -- 2 marks
      'PRELIM',                -- 4 marks
      'SECOND_ROUND',          -- 6 marks
      'REGIONAL_FINALIST',     -- 10 marks
      'NATIONAL_FINALIST',     -- 15 marks
      'INTERNATIONAL_WINNER'   -- 20 marks
    )
  ),
  stage_marks INTEGER NOT NULL CHECK (stage_marks IN (2, 4, 6, 10, 15, 20)),
  
  certificate_url TEXT,
  proof_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Same event → highest stage only
 * Sum across distinct events, cap 20
 */
async function calculateCompetitionMarks(studentId) {
  const result = await db.query(`
    SELECT 
      distinct_key_normalized,
      MAX(stage_marks) as max_stage_marks
    FROM competition_evidence
    WHERE student_id = $1 
      AND status = 'VERIFIED'
    GROUP BY distinct_key_normalized
  `, [studentId]);
  
  const totalMarks = result.rows.reduce((sum, row) => sum + row.max_stage_marks, 0);
  return Math.min(20, totalMarks);
}
```

---

## MODULE 5: Internship & Startup (20 marks)

### Database Schema
```sql
CREATE TABLE internship_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- distinct_key = company/startup name ONLY (no date)
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  company_name TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('RECRUITMENT', 'STARTUP')),
  
  -- Stage depends on track
  achievement_stage TEXT NOT NULL,
  stage_marks INTEGER NOT NULL,
  
  -- Details
  role TEXT,
  start_date DATE,
  end_date DATE,
  duration_months INTEGER,
  
  offer_letter_url TEXT,
  completion_certificate_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized),
  
  -- Track-specific stage validation
  CHECK (
    (track = 'RECRUITMENT' AND achievement_stage IN (
      'APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'JOINED', 'COMPLETED'
    ) AND stage_marks IN (2, 4, 6, 10, 15, 20))
    OR
    (track = 'STARTUP' AND achievement_stage IN (
      'IDEATION', 'PROTOTYPE', 'REGISTERED', 'FUNDED_SEED', 'REVENUE', 'SCALED'
    ) AND stage_marks IN (3, 5, 8, 10, 15, 20))
  )
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Group by distinct_key across BOTH tracks combined
 * Max per group, sum, cap at 20 total (not per track)
 */
async function calculateInternshipMarks(studentId) {
  const result = await db.query(`
    SELECT 
      distinct_key_normalized,
      MAX(stage_marks) as max_stage_marks
    FROM internship_evidence
    WHERE student_id = $1 
      AND status = 'VERIFIED'
    GROUP BY distinct_key_normalized
  `, [studentId]);
  
  const totalMarks = result.rows.reduce((sum, row) => sum + row.max_stage_marks, 0);
  return Math.min(20, totalMarks);
}
```

---

## MODULE 6: Foreign Language (15 marks)

### Database Schema
```sql
CREATE TABLE language_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  language TEXT NOT NULL CHECK (lower(trim(language)) != 'english'),  -- Reject English (case-insensitive)
  proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('A1', 'A2', 'B1')),
  
  certification_name TEXT,
  certificate_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Tiers: A1=7, A2=12, B1=15
 * Take MAX across language groups, do NOT sum
 */
async function calculateLanguageMarks(studentId) {
  const result = await db.query(`
    SELECT proficiency_level
    FROM language_evidence
    WHERE student_id = $1 
      AND status = 'VERIFIED'
      AND lower(trim(language)) != 'english'
  `, [studentId]);
  
  const tierMarks = {
    'A1': 7,
    'A2': 12,
    'B1': 15
  };
  
  let maxMarks = 0;
  for (const row of result.rows) {
    maxMarks = Math.max(maxMarks, tierMarks[row.proficiency_level] || 0);
  }
  
  return maxMarks;
}
```

---

## MODULE 7: GATE / Placement Exam (25 marks)

### Database Schema
```sql
CREATE TABLE gate_exam_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  exam_type TEXT NOT NULL CHECK (
    exam_type IN ('GATE', 'GRE', 'GMAT', 'CAT', 'TOEFL', 'IELTS', 'PTE')
  ),
  exam_year INTEGER,
  
  -- Computable fields for core GATE achievement
  tests_completed INTEGER DEFAULT 0,
  full_length_tests INTEGER DEFAULT 0,
  average_score_percent DECIMAL(5,2),
  diagnostic_completed BOOLEAN DEFAULT FALSE,
  official_appearance BOOLEAN DEFAULT FALSE,
  qualified BOOLEAN DEFAULT FALSE,
  gate_score DECIMAL(5,2),
  branch_code TEXT,
  
  -- Bonus exam eligibility
  is_bonus_exam BOOLEAN DEFAULT FALSE,
  
  certificate_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);

-- Branch calibration table
CREATE TABLE gate_branch_calibration (
  id SERIAL PRIMARY KEY,
  branch TEXT NOT NULL,
  year INTEGER NOT NULL,
  threshold_score DECIMAL(5,2) NOT NULL,
  UNIQUE (branch, year)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Core tiers (highest match wins, NOT additive):
 * - diagnostic_completed + 3 tests = 3 marks
 * - 5+ tests = 5 marks
 * - 10+ tests + 40% avg = 10 marks
 * - 15+ tests + 3 full-length + 55% avg = 15 marks OR official_appearance = 15 marks
 * - qualified = 20 marks
 * - gate_score >= branch threshold = 25 marks
 * 
 * Optional bonus (only if core >= 5):
 * - GRE/GMAT/CAT: +3
 * - TOEFL/IELTS/PTE: +5
 * 
 * Final cap: 25 marks
 */
async function calculateGateMarks(studentId) {
  const exams = await db.query(`
    SELECT 
      exam_type,
      tests_completed,
      full_length_tests,
      average_score_percent,
      diagnostic_completed,
      official_appearance,
      qualified,
      gate_score,
      branch_code,
      exam_year,
      is_bonus_exam
    FROM gate_exam_evidence
    WHERE student_id = $1 AND status = 'VERIFIED'
  `, [studentId]);
  
  let bestCore = 0;
  
  // Calculate core marks for non-bonus exams
  for (const exam of exams.rows) {
    if (exam.is_bonus_exam) continue;
    
    let coreMarks = 0;
    
    // Tier 6: Branch-calibrated GATE score (25 marks)
    if (exam.gate_score && exam.branch_code) {
      const calibration = await db.query(`
        SELECT threshold_score
        FROM gate_branch_calibration
        WHERE branch = $1 AND year = $2
      `, [exam.branch_code, exam.exam_year || new Date().getFullYear()]);
      
      if (calibration.rows.length > 0 && exam.gate_score >= calibration.rows[0].threshold_score) {
        coreMarks = 25;
      }
    }
    
    // Tier 5: Qualified (20 marks)
    if (coreMarks < 20 && exam.qualified) {
      coreMarks = 20;
    }
    
    // Tier 4: Official appearance OR (15+ tests + 3 full-length + 55% avg) (15 marks)
    if (coreMarks < 15) {
      if (exam.official_appearance) {
        coreMarks = 15;
      } else if (
        exam.tests_completed >= 15 &&
        exam.full_length_tests >= 3 &&
        exam.average_score_percent >= 55
      ) {
        coreMarks = 15;
      }
    }
    
    // Tier 3: 10+ tests + 40% avg (10 marks)
    if (coreMarks < 10 && exam.tests_completed >= 10 && exam.average_score_percent >= 40) {
      coreMarks = 10;
    }
    
    // Tier 2: 5+ tests (5 marks)
    if (coreMarks < 5 && exam.tests_completed >= 5) {
      coreMarks = 5;
    }
    
    // Tier 1: diagnostic + 3 tests (3 marks)
    if (coreMarks < 3 && exam.diagnostic_completed && exam.tests_completed >= 3) {
      coreMarks = 3;
    }
    
    bestCore = Math.max(bestCore, coreMarks);
  }
  
  // Calculate bonus (only if core >= 5)
  let bonus = 0;
  if (bestCore >= 5) {
    for (const exam of exams.rows) {
      if (exam.is_bonus_exam) {
        if (['GRE', 'GMAT', 'CAT'].includes(exam.exam_type)) {
          bonus = Math.max(bonus, 3);
        } else if (['TOEFL', 'IELTS', 'PTE'].includes(exam.exam_type)) {
          bonus = Math.max(bonus, 5);
        }
      }
    }
  }
  
  return Math.min(25, bestCore + bonus);
}
```

---

## MODULE 8: Monthly Coding Assessment (20 marks)

### Database Schema
```sql
CREATE TABLE monthly_coding_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- distinct_key = YYYY_MM
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 6),
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  problems_solved INTEGER,
  
  -- Auto-imported
  status TEXT DEFAULT 'VERIFIED',
  verification_source TEXT DEFAULT 'AUTO_IMPORT',
  imported_by TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * Tiers: 0/5/10/15/20 at average thresholds 50/60/70/80
 * SEM 1: average that semester's scores only
 * SEM 2-6: CUMULATIVE average (all scores from SEM 1 through current)
 */
async function calculateMonthlyCodingMarks(studentId, currentSemester) {
  let scores;
  
  if (currentSemester === 1) {
    // Only semester 1 scores
    scores = await db.query(`
      SELECT percentage
      FROM monthly_coding_evidence
      WHERE student_id = $1 AND semester = 1
    `, [studentId]);
  } else {
    // CUMULATIVE: all scores from semester 1 through current
    scores = await db.query(`
      SELECT percentage
      FROM monthly_coding_evidence
      WHERE student_id = $1 AND semester <= $2
    `, [studentId, currentSemester]);
  }
  
  if (scores.rows.length === 0) return 0;
  
  const average = scores.rows.reduce((sum, s) => sum + s.percentage, 0) / scores.rows.length;
  
  // Tier thresholds
  if (average >= 80) return 20;
  if (average >= 70) return 15;
  if (average >= 60) return 10;
  if (average >= 50) return 5;
  return 0;
}
```

---

## MODULE 9: Hundred Days Training (15 marks)

### Database Schema
```sql
CREATE TABLE hundred_days_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- No distinct_key - only ONE record per student
  
  training_program TEXT NOT NULL CHECK (
    training_program IN ('PEP', 'HOPE_NON_ELITE', 'HOPE_ELITE', 'NOT_SELECTED')
  ),
  selection_year INTEGER,
  
  selection_letter_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * One-time lookup: PEP=5, HOPE Non-Elite=10, HOPE Elite=15
 * NO accumulation - only highest category
 */
async function calculateHundredDaysMarks(studentId) {
  const result = await db.query(`
    SELECT training_program
    FROM hundred_days_evidence
    WHERE student_id = $1 AND status = 'VERIFIED'
  `, [studentId]);
  
  if (result.rows.length === 0) return 0;
  
  const program = result.rows[0].training_program;
  
  switch (program) {
    case 'HOPE_ELITE': return 15;
    case 'HOPE_NON_ELITE': return 10;
    case 'PEP': return 5;
    default: return 0;
  }
}
```

---

## MODULE 10: Aptitude & Communication (20 marks)

### Database Schema
```sql
CREATE TABLE aptitude_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  -- TWO independent categories
  category TEXT NOT NULL CHECK (category IN ('APTITUDE', 'COMMUNICATION')),
  
  test_name TEXT NOT NULL,
  test_date DATE,
  
  -- For APTITUDE: use percentile
  percentile DECIMAL(5,2),
  test_completed BOOLEAN DEFAULT FALSE,  -- For tier-3 without percentile floor
  
  -- For COMMUNICATION: scorecard/threshold
  has_valid_scorecard BOOLEAN,
  meets_central_threshold BOOLEAN,
  
  certificate_url TEXT,
  
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'MENTOR_MANUAL',
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized)
);
```

### Scoring Logic (EXACT)
```javascript
/**
 * TWO independent categories
 * Aptitude tiers: 3/6/9/12/15 by percentile (tier-3 = test completed, no percentile floor)
 * Communication tiers: 3 (valid scorecard) / 5 (central threshold)
 * Best score WITHIN each category, then SUM the two bests
 */
async function calculateAptitudeMarks(studentId) {
  const tests = await db.query(`
    SELECT category, percentile, test_completed, has_valid_scorecard, meets_central_threshold
    FROM aptitude_evidence
    WHERE student_id = $1 AND status = 'VERIFIED'
  `, [studentId]);
  
  let bestAptitude = 0;
  let bestCommunication = 0;
  
  for (const test of tests.rows) {
    if (test.category === 'APTITUDE') {
      // Aptitude tiers by percentile
      const p = test.percentile;
      let marks = 0;
      
      // Check percentile tiers first
      if (p >= 90) marks = 15;
      else if (p >= 80) marks = 12;
      else if (p >= 70) marks = 9;
      else if (p >= 60) marks = 6;
      // Tier 3: test completed (no percentile floor required)
      else if (test.test_completed) marks = 3;
      
      bestAptitude = Math.max(bestAptitude, marks);
      
    } else if (test.category === 'COMMUNICATION') {
      // Communication tiers
      let marks = 0;
      if (test.meets_central_threshold) marks = 5;
      else if (test.has_valid_scorecard) marks = 3;
      
      bestCommunication = Math.max(bestCommunication, marks);
    }
  }
  
  return bestAptitude + bestCommunication;
}
```

---

## MODULE 11: Certificate Achievement (20 marks)

### Database Schema
```sql
CREATE TABLE certificate_evidence (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES profiles(id_number) ON DELETE RESTRICT,
  
  -- distinct_key = credential name
  distinct_key TEXT NOT NULL,
  distinct_key_normalized TEXT GENERATED ALWAYS AS (lower(trim(distinct_key))) STORED,
  
  credential_name TEXT NOT NULL,
  issuing_organization TEXT,
  issue_date DATE,
  
  -- Academic or Industry
  credential_category TEXT NOT NULL CHECK (credential_category IN ('ACADEMIC', 'INDUSTRY')),
  
  -- Tier within category
  credential_tier TEXT NOT NULL,
  tier_marks INTEGER NOT NULL,
  
  -- Foundation-level flag for cap
  is_foundation_level BOOLEAN DEFAULT FALSE,
  
  certificate_url TEXT NOT NULL,
  
  -- Platform-assisted verification
  verify_url TEXT,  -- Credly, NPTEL, Coursera verification link
  auto_check_result TEXT CHECK (
    auto_check_result IN ('MATCHED', 'NOT_MATCHED', 'NO_VERIFY_LINK', 'NOT_CHECKED')
  ) DEFAULT 'NOT_CHECKED',
  auto_check_message TEXT,  -- Details from auto-check (name match, date match, etc)
  auto_checked_at TIMESTAMPTZ,
  
  -- Single mentor verification (NO HOD, NO second approver)
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  mentor_id TEXT REFERENCES profiles(id_number),
  verified_at TIMESTAMPTZ,
  verification_source TEXT DEFAULT 'PLATFORM_PARTIAL',  -- Changes to MENTOR_MANUAL if no verify_url
  rejection_reason TEXT,
  
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (student_id, distinct_key_normalized),
  
  CHECK (
    (credential_category = 'ACADEMIC' AND tier_marks IN (3, 5, 10, 15))
    OR
    (credential_category = 'INDUSTRY' AND tier_marks IN (5, 10, 15))
  )
);
```

### Verification Flow
```javascript
/**
 * Certificate submission with auto-check
 */
async function submitCertificate(data) {
  // 1. Insert certificate record
  const cert = await db.insert('certificate_evidence', {
    ...data,
    status: 'PENDING',
    verification_source: data.verify_url ? 'PLATFORM_PARTIAL' : 'MENTOR_MANUAL'
  });
  
  // 2. If verify_url exists, run auto-check BEFORE mentor sees it
  if (data.verify_url) {
    const checkResult = await autoCheckCertificate(data.verify_url, data.credential_name, data.issue_date);
    
    await db.update('certificate_evidence', cert.id, {
      auto_check_result: checkResult.status,  // MATCHED, NOT_MATCHED, NO_VERIFY_LINK
      auto_check_message: checkResult.message,
      auto_checked_at: new Date()
    });
  }
  
  // 3. Still PENDING - waits for single mentor approval
  return cert;
}

/**
 * Auto-check logic (runs before mentor review)
 */
async function autoCheckCertificate(verifyUrl, claimedName, claimedDate) {
  try {
    // Detect platform from URL
    if (verifyUrl.includes('credly.com')) {
      return await checkCredly(verifyUrl, claimedName, claimedDate);
    } else if (verifyUrl.includes('nptel.ac.in')) {
      return await checkNPTEL(verifyUrl, claimedName, claimedDate);
    } else if (verifyUrl.includes('coursera.org')) {
      return await checkCoursera(verifyUrl, claimedName, claimedDate);
    }
    
    return { status: 'NO_VERIFY_LINK', message: 'Unsupported verification platform' };
  } catch (error) {
    return { status: 'NOT_CHECKED', message: error.message };
  }
}
```

### Scoring Logic (EXACT)
```javascript
/**
 * Group by credential name, max per group, sum, cap 20
 * Academic tiers: 3/5/10/15
 * Industry tiers: 5/10/15
 * Foundation-level subset capped at 10 within overall 20 cap
 */
async function calculateCertificateMarks(studentId) {
  const result = await db.query(`
    SELECT 
      distinct_key_normalized,
      MAX(tier_marks) as max_marks,
      BOOL_OR(is_foundation_level) as is_foundation
    FROM certificate_evidence
    WHERE student_id = $1 AND status = 'VERIFIED'
    GROUP BY distinct_key_normalized
  `, [studentId]);
  
  let foundationTotal = 0;
  let nonFoundationTotal = 0;
  
  for (const row of result.rows) {
    if (row.is_foundation) {
      foundationTotal += row.max_marks;
    } else {
      nonFoundationTotal += row.max_marks;
    }
  }
  
  // Apply foundation cap first
  const foundationCapped = Math.min(10, foundationTotal);
  
  // Then apply overall cap
  const totalMarks = foundationCapped + nonFoundationTotal;
  return Math.min(20, totalMarks);
}
```

---

## 🏗️ BACKEND STRUCTURE

```
backend/core/src/
├── routes/
│   ├── codingProblemsRoutes.js
│   ├── cpRatingRoutes.js
│   ├── opensourceRoutes.js
│   ├── competitionRoutes.js
│   ├── internshipRoutes.js
│   ├── languageRoutes.js
│   ├── gateExamRoutes.js
│   ├── monthlyCodingRoutes.js
│   ├── hundredDaysRoutes.js
│   ├── aptitudeRoutes.js
│   └── certificateRoutes.js
│
├── services/
│   ├── marksCalculator.js (all scoring functions)
│   ├── leetcodeService.js
│   ├── codeforcesService.js
│   ├── githubService.js
│   └── fileUpload.js
│
└── middleware/
    ├── auth.js
    └── roleCheck.js
```

---

## 📅 IMPLEMENTATION PHASES

### Phase 1: Simple Lookups (Week 1)
1. Hundred Days Training (one-time lookup)
2. Foreign Language (tier-based)
3. GATE Exam (tier with bonus)

### Phase 2: Document Submissions (Week 2)
4. Competition Achievement
5. Internship & Startup (dual track)
6. Certificate Achievement
7. Aptitude & Communication (dual category)

### Phase 3: Platform Integrations (Week 3-4)
8. Coding Problems (auto-fetch)
9. CP Rating (auto-fetch)
10. Open Source (GitHub API)

### Phase 4: Existing (Week 5)
11. Monthly Coding Assessment (already partially built)

---

## ⚠️ CRITICAL CONFIRMATIONS NEEDED

### 1. CP Rating Tier Cutoffs
Need actual thresholds for each platform:
- **Codeforces**: ?/?/?/? for 5/10/15/20 marks
- **CodeChef**: ?/?/?/? for 5/10/15/20 marks  
- **LeetCode**: ?/?/?/? for 5/10/15/20 marks

### 2. Certificate Achievement Clarification
- ✅ Confirmed: Single mentor verification (no HOD)
- ❓ Question: Which specific credential tiers are "foundation-level" (for the 10-mark sub-cap)?

### 3. GATE Branch Calibration
- Need branch-specific score thresholds for "BRANCH_CALIBRATED_SCORE" tier
- Which branches need calibration data?

---

## ✅ VERIFICATION WORKFLOW CONFIRMATION

**CONFIRMED: Single Mentor Approval Across ALL 11 Modules**

| Module | Verification Type | Source Value | Second Approver? |
|--------|------------------|--------------|------------------|
| Coding Problems | Auto-fetch | `AUTO_FETCH` | ❌ NO |
| CP Rating | Auto-fetch | `AUTO_FETCH` | ❌ NO |
| Open Source | Manual (with GitHub stats) | `MENTOR_MANUAL` | ❌ NO |
| Competition | Pure manual | `MENTOR_MANUAL` | ❌ NO |
| Internship & Startup | Pure manual | `MENTOR_MANUAL` | ❌ NO |
| Foreign Language | Pure manual | `MENTOR_MANUAL` | ❌ NO |
| GATE / Placement Exam | Pure manual | `MENTOR_MANUAL` | ❌ NO |
| Monthly Coding | Auto-import | `AUTO_IMPORT` | ❌ NO |
| Hundred Days Training | Pure manual | `MENTOR_MANUAL` | ❌ NO |
| Aptitude & Communication | Pure manual | `MENTOR_MANUAL` | ❌ NO |
| Certificate Achievement | Platform-assisted | `PLATFORM_PARTIAL` | ❌ NO |

**Certificate Achievement special case:**
- Auto-check runs BEFORE mentor sees submission
- Auto-check result stored in `auto_check_result` column
- Mentor sees: certificate proof + auto-check result
- Mentor makes ONE final decision: VERIFIED or REJECTED
- Still single approval - auto-check is INPUT, not a second approver

**Database Guarantee:**
- ✅ ZERO tables have `mentor_2_id` column
- ✅ ZERO tables have `hod_id` column
- ✅ ZERO tables have `hod_status` column
- ✅ ZERO tables have `final_approver` column
- ✅ ALL tables have exactly ONE `mentor_id` column

---

## ✋ AWAITING APPROVAL

**DO NOT IMPLEMENT until you confirm**:
1. ✅ Category 1: profiles.id_number as FK everywhere
2. ✅ Category 2: Exact scoring logic for all 11 modules
3. ✅ Category 3: Single mentor verification (NO second approver in ANY module)
4. ✅ Certificate auto-check added (runs before mentor review)
5. ❓ Provide CP Rating tier cutoffs (Codeforces, CodeChef, LeetCode)
6. ❓ Clarify certificate foundation-level tiers (which credentials count as "foundation"?)
7. ❓ Provide GATE branch calibration thresholds

**I will wait for your "APPROVED" before writing any code.**
