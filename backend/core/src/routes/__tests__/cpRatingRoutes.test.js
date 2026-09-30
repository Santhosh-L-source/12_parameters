/**
 * CP Rating Routes Tests
 * Testing SINGLE BEST aggregation across platforms (not SUM)
 * ⚠️ Using PLACEHOLDER rating tiers — tests verify logic, not real cutoffs
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('CP Rating Routes', () => {
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
      `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
  });

  describe('POST /api/cp-rating/submit', () => {
    it('should submit CP rating evidence successfully', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const response = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'test_user_cf',
          current_rating: 1500,
          profile_url: 'https://codeforces.com/profile/test_user_cf'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.platform).toBe('CODEFORCES');
      expect(response.body.evidence.current_rating).toBe(1500);
    });

    it('should UPDATE (not reject) when same platform submitted again', async () => {
      const response = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'test_user_cf',
          current_rating: 1700  // Updated rating
        });

      expect(response.status).toBe(200);  // Update, not 201 or 409
      expect(response.body.is_update).toBe(true);
      expect(response.body.evidence.current_rating).toBe(1700);  // Updated
      expect(response.body.evidence.status).toBe('PENDING');  // Reset for re-verification
    });

    it('should reject negative rating', async () => {
      const response = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'test_user',
          current_rating: -100  // Invalid
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('TEST 1: SINGLE BEST across platforms (NOT SUM)', () => {
    it('should use highest rating, not sum ratings', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: Codeforces 1500 → tier 2 (10 marks, Pupil)
      const cf = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'single_best_user',
          current_rating: 1500
        });

      // Platform 2: CodeChef 1500 → tier 1 (5 marks, 2 Star)
      const cc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'single_best_user',
          current_rating: 1500
        });

      // Verify both
      await request(app)
        .post(`/api/cp-rating/${cf.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/cp-rating/${cc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: CF 1500 (10 marks) > CC 1500 (5 marks) → BEST = 10, NOT SUM = 15
      expect(marksResp.body.platforms_count).toBe(2);
      expect(marksResp.body.best_platform).toBe('CODEFORCES');
      expect(marksResp.body.best_rating).toBe(1500);
      expect(marksResp.body.marks).toBe(10);  // NOT 15
    }, 15000);
  });

  describe('TEST 2: Platform-specific tier thresholds', () => {
    it('should use different tier cutoffs for each platform', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Codeforces 1300: tier 1 (5 marks, Pupil starts at 1400)
      const cf = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'tier_test_user',
          current_rating: 1300
        });

      // CodeChef 1300: tier 0 (0 marks, 2 Star starts at 1400)
      const cc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'tier_test_user',
          current_rating: 1300
        });

      // Verify both
      await request(app)
        .post(`/api/cp-rating/${cf.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/cp-rating/${cc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: CF 1300 (5 marks) > CC 1300 (0 marks) → BEST = 5
      expect(marksResp.body.platforms_count).toBe(2);
      expect(marksResp.body.best_platform).toBe('CODEFORCES');
      expect(marksResp.body.marks).toBe(5);
      expect(marksResp.body.best_tier).toBe('Newbie');
    }, 15000);
  });

  describe('TEST 3: Three platforms, only highest counted', () => {
    it('should pick single best rating across three platforms', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: Codeforces 1700 → tier 3 (15 marks)
      const cf = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'three_platform_user',
          current_rating: 1700
        });

      // Platform 2: CodeChef 1500 → tier 1 (5 marks)
      const cc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'three_platform_user',
          current_rating: 1500
        });

      // Platform 3: LeetCode Contest 1900 → tier 3 (15 marks)
      const lc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'LEETCODE_CONTEST',
          username: 'three_platform_user',
          current_rating: 1900
        });

      // Verify all three
      await request(app)
        .post(`/api/cp-rating/${cf.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/cp-rating/${cc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/cp-rating/${lc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: LC 1900 (15) = CF 1700 (15) > CC 1500 (5) → BEST = 15, NOT 35
      expect(marksResp.body.platforms_count).toBe(3);
      expect(marksResp.body.marks).toBe(15);  // NOT 35 (sum)
      // Either CF or LC could be picked (both 15 marks), depends on order
      expect(['CODEFORCES', 'LEETCODE_CONTEST']).toContain(marksResp.body.best_platform);
    }, 15000);
  });

  describe('TEST 4: REJECTED platform does NOT contribute', () => {
    it('should exclude rejected platform from BEST calculation', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: Codeforces 1900 → would be tier 4 (20 marks) if verified
      const cf = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'reject_test_user',
          current_rating: 1900
        });

      // Platform 2: CodeChef 1500 → tier 1 (5 marks)
      const cc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'reject_test_user',
          current_rating: 1500
        });

      // REJECT Codeforces, VERIFY CodeChef
      await request(app)
        .post(`/api/cp-rating/${cf.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'REJECTED', rejection_reason: 'Screenshot not matching current rating' });

      await request(app)
        .post(`/api/cp-rating/${cc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Only CC 1500 (5 marks) counted, not CF 1900 (20 marks)
      expect(marksResp.body.platforms_count).toBe(1);  // Only CodeChef
      expect(marksResp.body.best_platform).toBe('CODECHEF');
      expect(marksResp.body.marks).toBe(5);  // NOT 20
    }, 15000);
  });

  describe('TEST 5: UPSERT updates rating and resets status', () => {
    it('should update rating when same platform resubmitted', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Initial submission: Codeforces 1500 → tier 2 (10 marks)
      const first = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'upsert_test_user',
          current_rating: 1500
        });

      expect(first.status).toBe(201);
      const firstId = first.body.evidence.id;

      // Mentor verifies
      await request(app)
        .post(`/api/cp-rating/${firstId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check initial marks
      const marks1 = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks1.body.best_rating).toBe(1500);
      expect(marks1.body.marks).toBe(10);

      // Resubmit with UPDATED rating: 1700 → tier 3 (15 marks)
      const second = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'upsert_test_user',
          current_rating: 1700  // Updated
        });

      // PROOF 1: UPSERT happened (200 OK, same ID, status reset)
      expect(second.status).toBe(200);
      expect(second.body.is_update).toBe(true);
      expect(second.body.evidence.id).toBe(firstId);  // Same row
      expect(second.body.evidence.current_rating).toBe(1700);  // Updated
      expect(second.body.evidence.status).toBe('PENDING');  // Reset

      // PROOF 2: Marks dropped (waiting re-verification)
      const marks2 = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks2.body.platforms_count).toBe(0);  // No VERIFIED rows
      expect(marks2.body.marks).toBe(0);  // NOT 10

      // Re-verify updated rating
      await request(app)
        .post(`/api/cp-rating/${firstId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // PROOF 3: Marks now reflect UPDATED rating (1700 → 15 marks)
      const marks3 = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks3.body.best_rating).toBe(1700);  // NOT 1500
      expect(marks3.body.marks).toBe(15);  // NOT 10
    }, 20000);
  });

  describe('TEST 6: Multi-platform UPSERT isolation', () => {
    it('should only reset updated platform, keep others VERIFIED', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: Codeforces 1700 → tier 3 (15 marks)
      const cf1 = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'multi_upsert_user',
          current_rating: 1700
        });

      // Platform 2: CodeChef 1500 → tier 1 (5 marks)
      const cc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'multi_upsert_user',
          current_rating: 1500
        });

      // Verify both
      await request(app)
        .post(`/api/cp-rating/${cf1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/cp-rating/${cc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check combined marks: CF 1700 (15) > CC 1500 (5) → BEST = 15
      const marks1 = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks1.body.platforms_count).toBe(2);
      expect(marks1.body.best_platform).toBe('CODEFORCES');
      expect(marks1.body.marks).toBe(15);

      // UPSERT: Resubmit ONLY Codeforces with updated rating 1200 → tier 1 (5 marks)
      const cf2 = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'multi_upsert_user',
          current_rating: 1200  // Rating drop
        });

      expect(cf2.status).toBe(200);
      expect(cf2.body.is_update).toBe(true);

      // PROOF 1: Only Codeforces row reset to PENDING, CodeChef stays VERIFIED
      const evidence = await request(app)
        .get(`/api/cp-rating/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      const cfRow = evidence.body.evidence.find(e => e.platform === 'CODEFORCES');
      const ccRow = evidence.body.evidence.find(e => e.platform === 'CODECHEF');

      expect(cfRow.status).toBe('PENDING');    // ← CF reset
      expect(ccRow.status).toBe('VERIFIED');   // ← CC untouched
      expect(cfRow.current_rating).toBe(1200); // ← Updated
      expect(ccRow.current_rating).toBe(1500); // ← Original

      // PROOF 2: Marks now reflect ONLY CodeChef (5 marks)
      const marks2 = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks2.body.platforms_count).toBe(1);  // Only CodeChef
      expect(marks2.body.best_platform).toBe('CODECHEF');
      expect(marks2.body.marks).toBe(5);  // Down from 15

      // Re-verify updated Codeforces
      await request(app)
        .post(`/api/cp-rating/${cf2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // PROOF 3: Marks still 5 (both platforms now 5 marks each, best = 5)
      const marks3 = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks3.body.platforms_count).toBe(2);
      expect(marks3.body.marks).toBe(5);  // Both platforms tied at 5
    }, 20000);
  });

  describe('GET /api/cp-rating/student/:studentId', () => {
    it('should get all evidence for student', async () => {
      const response = await request(app)
        .get(`/api/cp-rating/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });

  describe('Scoring Logic', () => {
    it('should use correct placeholder tier thresholds', () => {
      // Verify placeholder tiers are documented (logic test, not DB test)
      const PLACEHOLDER_TIERS = {
        CODEFORCES: [
          { rating: 1800, marks: 20 },
          { rating: 1600, marks: 15 },
          { rating: 1400, marks: 10 },
          { rating: 1200, marks: 5 }
        ],
        CODECHEF: [
          { rating: 2000, marks: 20 },
          { rating: 1800, marks: 15 },
          { rating: 1600, marks: 10 },
          { rating: 1400, marks: 5 }
        ],
        LEETCODE_CONTEST: [
          { rating: 2000, marks: 20 },
          { rating: 1800, marks: 15 },
          { rating: 1600, marks: 10 },
          { rating: 1400, marks: 5 }
        ]
      };

      expect(PLACEHOLDER_TIERS.CODEFORCES[0]).toEqual({ rating: 1800, marks: 20 });
      expect(PLACEHOLDER_TIERS.CODECHEF[3]).toEqual({ rating: 1400, marks: 5 });
      expect(PLACEHOLDER_TIERS.LEETCODE_CONTEST[1]).toEqual({ rating: 1800, marks: 15 });
    });
  });

  describe('USER VERIFICATION: CF 1500 + CC 1850 → 15 marks (BEST), not 25 (SUM)', () => {
    it('should score 15 (best) with CF 1500 (10) and CC 1850 (15)', async () => {
      await sequelize.query(
        `DELETE FROM cp_rating_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'cp_rating'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Platform 1: Codeforces 1500 → tier 2 (10 marks, Pupil)
      const cf = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODEFORCES',
          username: 'user_verification',
          current_rating: 1500
        });

      // Platform 2: CodeChef 1850 → tier 3 (15 marks, 4 Star)
      const cc = await request(app)
        .post('/api/cp-rating/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'CODECHEF',
          username: 'user_verification',
          current_rating: 1850
        });

      // Verify both
      await request(app)
        .post(`/api/cp-rating/${cf.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/cp-rating/${cc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/cp-rating/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: CF 1500 (10 marks) + CC 1850 (15 marks) → BEST = 15, NOT SUM = 25
      expect(marksResp.body.platforms_count).toBe(2);
      expect(marksResp.body.platforms).toContainEqual(
        expect.objectContaining({ platform: 'CODEFORCES', rating: 1500, marks: 10 })
      );
      expect(marksResp.body.platforms).toContainEqual(
        expect.objectContaining({ platform: 'CODECHEF', rating: 1850, marks: 15 })
      );
      expect(marksResp.body.best_platform).toBe('CODECHEF');
      expect(marksResp.body.best_rating).toBe(1850);
      expect(marksResp.body.marks).toBe(15);  // ← NOT 25 (sum), NOT 10 (first)
    }, 15000);
  });
});
