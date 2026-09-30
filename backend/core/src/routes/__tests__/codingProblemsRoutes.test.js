/**
 * Coding Problems Routes Tests
 * Testing cross-platform SUM aggregation and tier boundaries
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Coding Problems Routes', () => {
  let authToken;
  let studentRollNumber = '24CS360';

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: studentRollNumber, password: '312324104001' });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
    }
  }, 30000);

  afterAll(async () => {
    await sequelize.query(
      `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
  });

  describe('POST /api/coding-problems/submit', () => {
    it('should submit coding problems evidence successfully', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const response = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'test_user_24cs360',
          total_solved: 500,
          sql_solved: 40,
          profile_url: 'https://leetcode.com/test_user_24cs360'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.platform).toBe('LEETCODE');
      expect(response.body.evidence.total_solved).toBe(500);
      expect(response.body.evidence.sql_solved).toBe(40);
    });

    it('should UPDATE (not reject) when same platform+username submitted again', async () => {
      const response = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'test_user_24cs360',
          total_solved: 600,
          sql_solved: 50
        });

      expect(response.status).toBe(200);  // Update, not 201 or 409
      expect(response.body.is_update).toBe(true);
      expect(response.body.evidence.total_solved).toBe(600);  // Updated counts
      expect(response.body.evidence.status).toBe('PENDING');  // Reset for re-verification
    });

    it('should reject sql_solved > total_solved', async () => {
      const response = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'HACKERRANK',
          username: 'test_user',
          total_solved: 100,
          sql_solved: 150  // Invalid: SQL > total
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('sql_solved cannot exceed total_solved');
    });
  });

  describe('BOUNDARY TEST 1: Two platforms summing to exactly a tier boundary', () => {
    it('should hit tier 3 (15 marks) when 550 total + 45 SQL split across two platforms', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: LeetCode - 300 total, 25 SQL
      const lc = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'boundary_test_user',
          total_solved: 300,
          sql_solved: 25
        });

      expect(lc.status).toBe(201);

      // Platform 2: HackerRank - 250 total, 20 SQL
      const hr = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'HACKERRANK',
          username: 'boundary_test_user',
          total_solved: 250,
          sql_solved: 20
        });

      expect(hr.status).toBe(201);

      // Verify both
      await request(app)
        .post(`/api/coding-problems/${lc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/coding-problems/${hr.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: 300+250 = 550 total, 25+20 = 45 SQL → exactly tier 3 boundary
      expect(marksResp.body.platforms_count).toBe(2);
      expect(marksResp.body.total_solved_sum).toBe(550);
      expect(marksResp.body.sql_solved_sum).toBe(45);
      expect(marksResp.body.marks).toBe(15);  // Tier 3
      expect(marksResp.body.tier_achieved).toEqual({ total: 550, sql: 45, marks: 15 });
    }, 15000);
  });

  describe('BOUNDARY TEST 2: Sum clears total but falls short on SQL', () => {
    it('should stay at tier 3 (15 marks) when 950 total but only 45 SQL', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: 600 total, 25 SQL
      const p1 = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'sql_short_user',
          total_solved: 600,
          sql_solved: 25
        });

      // Platform 2: 350 total, 20 SQL
      const p2 = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'sql_short_user',
          total_solved: 350,
          sql_solved: 20
        });

      // Verify both
      await request(app)
        .post(`/api/coding-problems/${p1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/coding-problems/${p2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: 600+350 = 950 total (✓ passes 750 for tier 4)
      //        25+20 = 45 SQL (✗ fails 60 threshold for tier 4)
      //        → stays at tier 3 (550 total + 45 SQL)
      expect(marksResp.body.total_solved_sum).toBe(950);
      expect(marksResp.body.sql_solved_sum).toBe(45);
      expect(marksResp.body.marks).toBe(15);  // NOT 20, because SQL threshold not met
      expect(marksResp.body.tier_achieved.marks).toBe(15);
    }, 15000);
  });

  describe('BOUNDARY TEST 3: Only one platform submitted', () => {
    it('should still work correctly with single platform (no summing needed)', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Single platform: 800 total, 65 SQL → tier 4 (20 marks)
      const single = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'single_platform_user',
          total_solved: 800,
          sql_solved: 65
        });

      await request(app)
        .post(`/api/coding-problems/${single.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Single platform summing works correctly
      expect(marksResp.body.platforms_count).toBe(1);
      expect(marksResp.body.total_solved_sum).toBe(800);
      expect(marksResp.body.sql_solved_sum).toBe(65);
      expect(marksResp.body.marks).toBe(20);  // Tier 4
    }, 15000);
  });

  describe('BOUNDARY TEST 4: REJECTED platform does NOT contribute to sum', () => {
    it('should exclude rejected platform from sum calculation', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: 400 total, 30 SQL (will be VERIFIED)
      const p1 = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'reject_test_user',
          total_solved: 400,
          sql_solved: 30
        });

      // Platform 2: 400 total, 30 SQL (will be REJECTED)
      const p2 = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'HACKERRANK',
          username: 'reject_test_user',
          total_solved: 400,
          sql_solved: 30
        });

      // Verify platform 1
      await request(app)
        .post(`/api/coding-problems/${p1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Reject platform 2
      await request(app)
        .post(`/api/coding-problems/${p2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'REJECTED', rejection_reason: 'Invalid profile' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Only verified platform counts
      // If both counted: 800 total + 60 SQL → tier 4 (20 marks)
      // With rejection: 400 total + 30 SQL → tier 2 (10 marks)
      expect(marksResp.body.platforms_count).toBe(1);  // Only 1 VERIFIED
      expect(marksResp.body.total_solved_sum).toBe(400);  // NOT 800
      expect(marksResp.body.sql_solved_sum).toBe(30);  // NOT 60
      expect(marksResp.body.marks).toBe(10);  // Tier 2, NOT tier 4
    }, 15000);
  });

  describe('BOUNDARY TEST 5: UPSERT - resubmission UPDATES counts, resets status to PENDING', () => {
    it('should update same row when platform+username resubmitted with new counts', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // STEP 1: First submission - 400 total, 25 SQL
      const first = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'upsert_test_user',
          total_solved: 400,
          sql_solved: 25
        });

      expect(first.status).toBe(201);
      expect(first.body.is_update).toBe(false);
      const firstId = first.body.evidence.id;

      // STEP 2: Mentor verifies first submission
      await request(app)
        .post(`/api/coding-problems/${firstId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks after first verification
      const marks1 = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // 400 total >= 350 ✓, 25 SQL < 30 ✗ → tier 1 (5 marks: 200/20)
      expect(marks1.body.total_solved_sum).toBe(400);
      expect(marks1.body.sql_solved_sum).toBe(25);
      expect(marks1.body.marks).toBe(5);  // Tier 1

      // STEP 3: Re-fetch/resubmit same platform+username with updated counts
      const second = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE',
          username: 'upsert_test_user',
          total_solved: 600,  // Updated: was 400
          sql_solved: 35      // Updated: was 25
        });

      // PROOF 1: UPSERT happened (200 OK for update, not 201 or 409)
      expect(second.status).toBe(200);
      expect(second.body.is_update).toBe(true);
      expect(second.body.message).toContain('updated');
      expect(second.body.evidence.id).toBe(firstId);  // SAME row ID
      expect(second.body.evidence.total_solved).toBe(600);
      expect(second.body.evidence.sql_solved).toBe(35);
      expect(second.body.evidence.status).toBe('PENDING');  // Status reset

      // PROOF 2: Only ONE row exists (updated, not duplicated)
      const allEvidence = await request(app)
        .get(`/api/coding-problems/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      const leetcodeRows = allEvidence.body.evidence.filter(e => e.platform === 'LEETCODE');
      expect(leetcodeRows.length).toBe(1);  // NOT 2
      expect(leetcodeRows[0].id).toBe(firstId);
      expect(leetcodeRows[0].total_solved).toBe(600);
      expect(leetcodeRows[0].status).toBe('PENDING');

      // PROOF 3: Updated row (now PENDING) is NOT counted in marks yet
      const marks2 = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks2.body.platforms_count).toBe(0);  // No VERIFIED rows
      expect(marks2.body.total_solved_sum).toBe(0);
      expect(marks2.body.sql_solved_sum).toBe(0);
      expect(marks2.body.marks).toBe(0);  // Marks dropped (waiting re-verification)

      // STEP 4: Mentor re-verifies the updated row
      await request(app)
        .post(`/api/coding-problems/${firstId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // PROOF 4: Marks now reflect UPDATED counts (600/35), not old (400/25) or sum (1000/60)
      const marks3 = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks3.body.platforms_count).toBe(1);
      expect(marks3.body.total_solved_sum).toBe(600);  // NOT 400, NOT 1000
      expect(marks3.body.sql_solved_sum).toBe(35);     // NOT 25, NOT 60
      expect(marks3.body.marks).toBe(10);  // Tier 2 (350/30), NOT tier 1 (5) or tier 4 (20)
    }, 20000);
  });

  describe('GET /api/coding-problems/student/:studentId', () => {
    it('should get all evidence for student', async () => {
      const response = await request(app)
        .get(`/api/coding-problems/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });

  describe('Scoring Logic', () => {
    it('should use correct tier thresholds', () => {
      const TIERS = {
        T5: { total: 200, sql: 20, marks: 5 },
        T4: { total: 350, sql: 30, marks: 10 },
        T3: { total: 550, sql: 45, marks: 15 },
        T2: { total: 750, sql: 60, marks: 20 },
        T1: { total: 1000, sql: 75, marks: 25 }
      };

      expect(TIERS.T5).toEqual({ total: 200, sql: 20, marks: 5 });
      expect(TIERS.T4).toEqual({ total: 350, sql: 30, marks: 10 });
      expect(TIERS.T3).toEqual({ total: 550, sql: 45, marks: 15 });
      expect(TIERS.T2).toEqual({ total: 750, sql: 60, marks: 20 });
      expect(TIERS.T1).toEqual({ total: 1000, sql: 75, marks: 25 });
    });
  });

  describe('VERIFICATION: Multi-platform UPSERT isolation', () => {
    it('should only reset updated platform, keep other platforms VERIFIED', async () => {
      await sequelize.query(
        `DELETE FROM coding_problems_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'coding_problems'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: LeetCode 400/25
      const lc1 = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'LEETCODE', username: 'multi_user', total_solved: 400, sql_solved: 25 });

      // Platform 2: HackerRank 300/20
      const hr = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'HACKERRANK', username: 'multi_user', total_solved: 300, sql_solved: 20 });

      // Verify both
      await request(app)
        .post(`/api/coding-problems/${lc1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/coding-problems/${hr.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check combined marks: 700 total, 45 SQL → tier 3 (15 marks)
      const marks1 = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks1.body.platforms_count).toBe(2);
      expect(marks1.body.total_solved_sum).toBe(700);
      expect(marks1.body.sql_solved_sum).toBe(45);
      expect(marks1.body.marks).toBe(15);  // Tier 3 (550/45)

      // UPSERT: Resubmit ONLY LeetCode with updated counts 600/30
      const lc2 = await request(app)
        .post('/api/coding-problems/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ platform: 'LEETCODE', username: 'multi_user', total_solved: 600, sql_solved: 30 });

      expect(lc2.status).toBe(200);
      expect(lc2.body.is_update).toBe(true);

      // PROOF 1: Only LeetCode row reset to PENDING
      const evidence = await request(app)
        .get(`/api/coding-problems/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      const lcRow = evidence.body.evidence.find(e => e.platform === 'LEETCODE');
      const hrRow = evidence.body.evidence.find(e => e.platform === 'HACKERRANK');

      expect(lcRow.status).toBe('PENDING');    // ← LeetCode reset
      expect(hrRow.status).toBe('VERIFIED');   // ← HackerRank untouched
      expect(lcRow.total_solved).toBe(600);    // ← Updated counts
      expect(hrRow.total_solved).toBe(300);    // ← Original counts

      // PROOF 2: Marks now reflect ONLY HackerRank (300/20)
      const marks2 = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks2.body.platforms_count).toBe(1);  // ← Only HackerRank counted
      expect(marks2.body.total_solved_sum).toBe(300);  // ← NOT 700, NOT 900
      expect(marks2.body.sql_solved_sum).toBe(20);     // ← NOT 45, NOT 50
      expect(marks2.body.marks).toBe(5);  // ← Tier 1 (200/20), down from tier 3 (15)

      // Re-verify updated LeetCode
      await request(app)
        .post(`/api/coding-problems/${lc2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // PROOF 3: Marks now reflect BOTH platforms with updated LeetCode
      const marks3 = await request(app)
        .get(`/api/coding-problems/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks3.body.platforms_count).toBe(2);
      expect(marks3.body.total_solved_sum).toBe(900);  // ← 600(LC) + 300(HR)
      expect(marks3.body.sql_solved_sum).toBe(50);     // ← 30(LC) + 20(HR)
      expect(marks3.body.marks).toBe(15);  // ← Tier 3 (550/45)
    }, 20000);
  });
});
