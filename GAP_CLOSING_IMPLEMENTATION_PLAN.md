# 📋 Corrected Implementation Plan: Gap-Closing Recommendation Feature for Readiness Advisor Agent

## 1. Overview & Objectives

This document specifies the exact architecture, verified scoring schemas, deterministic combination optimizer, LLM guardrails, REST API endpoints, and test suites for the **Gap-Closing Recommendation Feature** within the **HOPE 12-Parameters Academic & Placement Readiness Platform**.

---

## 2. Corrected Batch Scaling Multiplier Function

Keyed strictly by batch / admission year alone; `currentSemester` is used exclusively to evaluate the 2023–27 batch's 7th-semester cutoff:

```javascript
/**
 * Calculate batch-based readiness threshold scaling multiplier
 * 
 * Rules:
 * - 2024–28 batch (Admission 2024): 75% of each level's marks
 * - 2023–27 batch (Admission 2023): 50% until end of 7th semester; reverts to 100% in 8th semester
 * - 2022–26 batch & earlier: 100% full scale
 * 
 * @param {number} admissionYear - e.g. 2024, 2023, 2022
 * @param {number} currentSemester - 1 to 8
 * @returns {number} multiplier (0.75, 0.50, or 1.00)
 */
function getBatchScalingMultiplier(admissionYear, currentSemester = 1) {
  // 2024-28 Batch: 75% scaling
  if (admissionYear === 2024) {
    return 0.75;
  }

  // 2023-27 Batch: 50% scaling until end of 7th semester, 100% thereafter
  if (admissionYear === 2023) {
    return currentSemester <= 7 ? 0.50 : 1.00;
  }

  // 2022-26 Batch & senior batches: 100% standard baseline
  return 1.00;
}
```

---

## 3. Canonical Parameter Scoring Functions & Action Generators Audit

Every candidate action generator imports directly from the canonical scoring rules used by each module's actual backend `/verify` and `/marks` endpoints:

| Parameter | Max Marks | Canonical Scoring Module & Exported Tier Definitions | Multi-Part Structure & Aggregation Rule | Candidate Action Milestone Examples (Computed against real fields) | Parallel Eligible? |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **`coding_problems`** | 25 | `codingProblemsRoutes.js`<br>`TIERS = [`<br>`{ total: 1000, sql: 75, marks: 25 },`<br>`{ total: 750, sql: 60, marks: 20 },`<br>`{ total: 550, sql: 45, marks: 15 },`<br>`{ total: 350, sql: 30, marks: 10 },`<br>`{ total: 200, sql: 20, marks: 5 }]` | **AND rule**: `total_solved >= tier.total` AND `sql_solved >= tier.sql`. Summed across verified platforms. | • Solve 150 more problems, including 10 more SQL (reach 350 total, 30 SQL) `[+5m, 21d]`<br>• Solve 200 more problems, including 15 more SQL (reach 550 total, 45 SQL) `[+10m, 35d]`<br>• Reach 1,000 total problems & 75 SQL problems `[+25m, 75d]` | ✅ Yes |
| **`cp_rating`** | 20 | `cpRatingRoutes.js`<br>`Codeforces / CodeChef / LeetCode Contest / AtCoder`<br>Tiers: `1400 -> 5m, 1600 -> 10m, 1800 -> 15m, 2000+ -> 20m` | **MAX rule**: Single best rating across all verified platforms (not SUM). | • Participate in 3 live contests and reach 1400+ rating `[+5m, 21d]`<br>• Increase contest rating to 1600+ (Div 2) `[+10m, 45d]`<br>• Reach 1800+ rating (Expert tier) `[+15m, 60d]` | ✅ Yes |
| **`opensource`** | 20 | `openSourceRoutes.js`<br>`calculateStage(prs_submitted, prs_merged, prog_selected, is_maintainer)`:<br>`1 PR sub -> 3m, 1 merged -> 5m, 3 merged -> 10m, 5+ merged -> 15m, Selected -> 17m, Maintainer -> 20m` | **MAX per repo, SUM across repos**, capped at 20. | • Submit and merge 1 PR in an external open-source repository `[+5m, 7d]`<br>• Merge 3 PRs across external repositories `[+10m, 21d]`<br>• Become maintainer or achieve 5+ merged PRs in multiple repositories `[+15m, 45d]` | ✅ Yes |
| **`competition`** | 20 | `competitionRoutes.js`<br>`ROUND_MARKS = { VALID_COMPLETION: 2, PRELIM: 4, SECOND_ROUND: 6, REGIONAL_FINALIST: 10, NATIONAL_FINALIST: 15, INTERNATIONAL_WINNER: 20 }` | **MAX per event, SUM across distinct events**, capped at 20. | • Clear prelims / 2nd round in an inter-college technical hackathon `[+6m, 7d]`<br>• Reach Regional Finalist in a recognized hackathon `[+10m, 14d]`<br>• Reach National Finalist / Winner in an external contest `[+15m, 21d]` | ✅ Yes |
| **`internship`** | 20 | `internshipRoutes.js`<br>Recruitment: `APPLIED: 2, SHORTLISTED: 4, INTERVIEWED: 6, OFFERED: 10, JOINED: 15, COMPLETED: 20`<br>Startup: `IDEATION: 3, PROTOTYPE: 5, REGISTERED: 8, FUNDED_SEED: 10, REVENUE: 15, SCALED: 20` | **MAX per company, SUM across distinct companies**, capped at 20. | • Secure and accept industrial technical internship offer (`JOINED`) `[+15m, 30d]`<br>• Complete 8+ week industrial internship (`COMPLETED`) `[+20m, 60d]`<br>• Register technical startup with working prototype (`REGISTERED`) `[+8m, 30d]` | ❌ No (Sequential) |
| **`project`** | 30 | `projectPubPatentRoutes.js`<br>Project: `CONCEPT: 5, PROTOTYPE: 10, DEPLOYED: 15, MONETIZED: 20`<br>Publication: `CONF_LOCAL: 5, CONF_NAT: 10, JOURNAL_INDEXED: 15, HIGH_IMPACT: 20`<br>Patent: `FILED: 5, PUBLISHED: 10, GRANTED: 20` | **SUM across distinct outputs**, capped at 30. | • Deploy working prototype to production cloud with live URL `[+15m, 21d]`<br>• Publish peer-reviewed paper in Scopus/IEEE indexed journal `[+15m, 45d]`<br>• File intellectual property patent application `[+5m, 14d]` | ❌ No (Sequential) |
| **`language`** | 15 | `languageRoutes.js`<br>`LEVEL_MARKS = { A1: 7, A2: 12, B1: 15 }`<br>(Non-English languages: French, German, Japanese, etc.) | **MAX across languages (NOT sum)**, capped at 15. | • Complete JLPT N5 / Goethe A1 foreign language exam `[+7m, 30d]`<br>• Complete JLPT N4 / DELF A2 certification `[+12m, 60d]`<br>• Pass JLPT N3 / B1 intermediate level foreign language certification `[+15m, 90d]` | ✅ Yes |
| **`gate`** | 25 | `gateExamRoutes.js`<br>`calculateCoreMark(evidence)`:<br>• Diagnostic + 3 tests: 3m<br>• 5+ tests: 5m<br>• 10+ tests + 40% avg: 10m<br>• Official appearance OR (15+ tests + 3 full-length + 55% avg): 15m *(L3/Elite Qualifying!)*<br>• Qualified: 20m<br>• Score $\ge$ Branch Cutoff: 25m | **Highest tier match wins** (computed from 8 fields). | • Complete diagnostic test + 5 practice tests `[+5m, 10d]`<br>• Complete 10 tests with 40%+ average score `[+10m, 21d]`<br>• Complete 15+ tests, 3 full-length mocks with 55%+ avg score ($\ge 15$ marks, qualifies L3/Elite condition) `[+15m, 35d]` | ✅ Yes |
| **`monthly_coding`** | 20 | `monthlyCodingRoutes.js`<br>`calculateMonthlyCodingMarks(avgPercent)`:<br>`>= 50% -> 5m, >= 60% -> 10m, >= 70% -> 15m (L3/Elite Qualifying!), >= 80% -> 20m` | **Average score across verified monthly lab tests**. | • Attend and achieve $\ge 60\%$ average in monthly coding assessments `[+10m, 30d]`<br>• Achieve $\ge 70\%$ average in monthly assessments ($\ge 15$ marks, qualifies L3/Elite condition) `[+15m, 60d]`<br>• Achieve $\ge 80\%$ top-tier average in monthly assessments `[+20m, 90d]` | ❌ No (Sequential) |
| **`hundred_days`** | 15 | `hundredDaysRoutes.js`<br>`PROGRAM_MARKS = { PEP: 5, HOPE_NON_ELITE: 10, HOPE_ELITE: 15, NOT_SELECTED: 0 }` | **Single active verified program tier**. | • Complete PEP foundation milestone evaluation `[+5m, 15d]`<br>• Complete HOPE Non-Elite milestone evaluation `[+10m, 30d]`<br>• Complete HOPE Elite 100 Days milestone evaluation `[+15m, 45d]` | ❌ No (Sequential) |
| **`aptitude`** | 20 | `aptitudeCommunicationRoutes.js`<br>Aptitude (max 15): `<60% -> 3m, >=60% -> 6m, >=70% -> 9m, >=80% -> 12m, >=90% -> 15m`<br>Communication (max 5): `valid scorecard -> 3m, meets central threshold -> 5m` | **Two distinct categories**: Aptitude (max 15) + Communication (max 5), capped at 20. | • Score 70%+ in campus recruitment aptitude benchmark `[+9m, 14d]`<br>• Score 90%+ in high-difficulty aptitude test + submit communication scorecard `[+15m, 21d]`<br>• Submit communication test meeting central cutoff `[+5m, 7d]` | ✅ Yes |
| **`certificate`** | 20 | `certificateRoutes.js`<br>Academic: `BASIC: 3, INTERMEDIATE: 5, ADVANCED: 10, EXPERT: 15`<br>Industry: `ASSOCIATE: 5, PROFESSIONAL: 10, EXPERT: 15` | **Highest tier per credential, SUM distinct credentials**, foundation sub-cap 10, overall cap 20. | • Complete Industry Associate cert (AWS / Azure Fundamentals) `[+5m, 14d]`<br>• Complete Industry Professional cert (AWS Solutions Architect / CKA) `[+10m, 30d]`<br>• Complete Academic Advanced + Industry Expert credentials `[+20m, 45d]` | ✅ Yes |

---

## 4. Target Level Condition Enforcement

When targeting **Level 3 (160+)** or **Elite Tier (200+)**, the optimizer verifies:
$$\text{monthly\_coding} \ge 15 \quad\text{OR}\quad \text{gate} \ge 15$$

- If the student currently does not satisfy this condition, candidate combinations **must include** an action upgrading `monthly_coding` or `gate` to $\ge 15$.
- Combinations that bridge the numerical gap without meeting the level condition are rejected by the combination finder.

---

## 5. Database Schema & Tables

1. **`level_thresholds`** (Baseline definitions lookup table):
   - `id`, `level_key`, `name`, `base_min_marks`, `requires_condition`, `condition_description`
2. **`readiness_plans`** (Stored recommendations table):
   - `id`, `student_id`, `current_marks`, `target_marks`, `gap`, `target_level`, `condition_met`, `combinations_json`, `recommended_track`, `advisor_explanation`, `created_at`

---

## 6. Execution Steps

1. **Step 1**: Implement `marksCalculator.js` importing all exact tier tables, categories, and candidate action generators.
2. **Step 2**: Implement `gapCombinationFinder.js` with deterministic scheduling, parallel timeline optimization, and condition enforcement.
3. **Step 3**: Implement `readinessAdvisorService.js` with batch multiplier logic, prompt guardrails, and DB persistence.
4. **Step 4**: Set up database migrations and register `POST /api/readiness/close-gap/:studentId`.
5. **Step 5**: Run test suite (`gapCombinationFinder.test.js`) and output live verification results.
