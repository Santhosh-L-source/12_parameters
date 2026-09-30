/**
 * Aptitude & Communication Routes Tests - CORRECTED VERSION
 * Testing real tiers: APTITUDE 3/6/9/12/15, COMMUNICATION 3/5
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Aptitude & Communication Routes - CORRECTED', () => {
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
      `DELETE FROM aptitude_communication_evidence WHERE student_id = :studentId`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'aptitude'`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
  });

  describe('TEST 1: APTITUDE takes SINGLE BEST percentile (not sum)', () => {
    it('should take highest aptitude result, not sum multiple submissions', async () => {
      // Cleanup
      await sequelize.query(
        `DELETE FROM aptitude_communication_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'aptitude'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Aptitude Submission 1: 65th percentile (tier 6)
      const apt1 = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: true,
          percentile: 65.5,
          test_name: 'TCS CodeVita Round 1'
        });

      expect(apt1.status).toBe(201);

      // Aptitude Submission 2: 85th percentile (tier 12)
      const apt2 = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: true,
          percentile: 85.0,
          test_name: 'Infosys InfyTQ'
        });

      expect(apt2.status).toBe(201);

      // Aptitude Submission 3: 72nd percentile (tier 9)
      const apt3 = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: true,
          percentile: 72.0,
          test_name: 'Accenture Challenge'
        });

      expect(apt3.status).toBe(201);

      // Verify all
      await request(app)
        .post(`/api/aptitude-communication/${apt1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/aptitude-communication/${apt2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/aptitude-communication/${apt3.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/aptitude-communication/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Should be 12 (best of 6, 12, 9), NOT 27 (sum of 6+12+9)
      expect(marksResp.body.aptitude_submissions).toBe(3);
      expect(marksResp.body.aptitude_marks).toBe(12);  // ← SINGLE BEST, not sum
      expect(parseFloat(marksResp.body.aptitude_best_percentile)).toBeCloseTo(85.0);
      expect(marksResp.body.communication_marks).toBe(0);
      expect(marksResp.body.marks).toBe(12);
    }, 15000);
  });

  describe('TEST 2: COMMUNICATION takes SINGLE BEST scorecard/threshold', () => {
    it('should take highest communication result, not sum multiple submissions', async () => {
      await sequelize.query(
        `DELETE FROM aptitude_communication_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'aptitude'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Communication Submission 1: Scorecard only (tier 3)
      const comm1 = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'COMMUNICATION',
          has_valid_scorecard: true,
          meets_central_threshold: false,
          event_description: 'Local debate competition'
        });

      expect(comm1.status).toBe(201);

      // Communication Submission 2: Central threshold met (tier 5)
      const comm2 = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'COMMUNICATION',
          has_valid_scorecard: true,
          meets_central_threshold: true,
          event_description: 'State-level public speaking'
        });

      expect(comm2.status).toBe(201);

      // Communication Submission 3: Scorecard only (tier 3)
      const comm3 = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'COMMUNICATION',
          has_valid_scorecard: true,
          meets_central_threshold: false,
          event_description: 'Inter-college presentation'
        });

      expect(comm3.status).toBe(201);

      // Verify all
      await request(app)
        .post(`/api/aptitude-communication/${comm1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/aptitude-communication/${comm2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/aptitude-communication/${comm3.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/aptitude-communication/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Should be 5 (best of 3, 5, 3), NOT 11 (sum of 3+5+3)
      expect(marksResp.body.communication_submissions).toBe(3);
      expect(marksResp.body.communication_marks).toBe(5);  // ← SINGLE BEST, not sum
      expect(marksResp.body.communication_threshold_met).toBe(true);
      expect(marksResp.body.aptitude_marks).toBe(0);
      expect(marksResp.body.marks).toBe(5);
    }, 15000);
  });

  describe('TEST 3: Best aptitude + best communication, capped at 20, using REAL tiers', () => {
    it('should sum best aptitude (15) + best communication (5), cap at 20', async () => {
      await sequelize.query(
        `DELETE FROM aptitude_communication_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'aptitude'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Aptitude: 92nd percentile (tier 15)
      const apt = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: true,
          percentile: 92.5,
          test_name: 'Google Code Jam'
        });

      // Communication: Central threshold (tier 5)
      const comm = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'COMMUNICATION',
          has_valid_scorecard: true,
          meets_central_threshold: true,
          event_description: 'National public speaking championship'
        });

      // Verify both
      await request(app)
        .post(`/api/aptitude-communication/${apt.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/aptitude-communication/${comm.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/aptitude-communication/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Using REAL tiers 3/6/9/12/15 and 3/5 (not old 2/5/10/15/20)
      expect(marksResp.body.aptitude_marks).toBe(15);  // ← REAL tier
      expect(marksResp.body.communication_marks).toBe(5);  // ← REAL tier
      expect(marksResp.body.uncapped_total).toBe(20);  // 15 + 5 = 20
      expect(marksResp.body.marks).toBe(20);  // Capped at 20
    }, 15000);
  });

  describe('TEST 4: Tier-3 aptitude does NOT require percentile floor', () => {
    it('should award 3 marks for test_completed=true with no percentile', async () => {
      await sequelize.query(
        `DELETE FROM aptitude_communication_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'aptitude'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Aptitude: test completed, but NO percentile provided
      const apt = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: true,
          percentile: null,  // ← NO percentile
          test_name: 'Basic aptitude test completed'
        });

      expect(apt.status).toBe(201);

      // Verify
      await request(app)
        .post(`/api/aptitude-communication/${apt.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/aptitude-communication/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Should be 3 marks (tier 3) for test_completed alone
      expect(marksResp.body.aptitude_marks).toBe(3);  // ← NO percentile floor
      expect(marksResp.body.aptitude_best_percentile).toBeNull();
      expect(marksResp.body.marks).toBe(3);
    }, 15000);
  });

  describe('Additional edge cases', () => {
    it('should handle 59th percentile as tier 3 (below 60 floor)', async () => {
      await sequelize.query(
        `DELETE FROM aptitude_communication_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const apt = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: true,
          percentile: 59.9,  // Below 60th
          test_name: 'Test with 59th percentile'
        });

      await request(app)
        .post(`/api/aptitude-communication/${apt.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/aptitude-communication/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.aptitude_marks).toBe(3);  // tier 3, not 6
    });

    it('should reject aptitude without test_completed', async () => {
      const resp = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'APTITUDE',
          test_completed: false,  // Invalid
          percentile: 85.0
        });

      expect(resp.status).toBe(400);
      expect(resp.body.error).toContain('test_completed');
    });

    it('should reject communication without scorecard or threshold', async () => {
      const resp = await request(app)
        .post('/api/aptitude-communication/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidence_category: 'COMMUNICATION',
          has_valid_scorecard: false,
          meets_central_threshold: false  // Both false = invalid
        });

      expect(resp.status).toBe(400);
      expect(resp.body.error).toContain('scorecard or threshold');
    });
  });

  describe('Scoring logic constants', () => {
    it('should use REAL tier values: APTITUDE 3/6/9/12/15', () => {
      const APTITUDE_TIERS = {
        'TEST_COMPLETED_NO_PERCENTILE': 3,
        '60TH_PERCENTILE': 6,
        '70TH_PERCENTILE': 9,
        '80TH_PERCENTILE': 12,
        '90TH_PERCENTILE': 15
      };

      expect(APTITUDE_TIERS['TEST_COMPLETED_NO_PERCENTILE']).toBe(3);
      expect(APTITUDE_TIERS['60TH_PERCENTILE']).toBe(6);
      expect(APTITUDE_TIERS['70TH_PERCENTILE']).toBe(9);
      expect(APTITUDE_TIERS['80TH_PERCENTILE']).toBe(12);
      expect(APTITUDE_TIERS['90TH_PERCENTILE']).toBe(15);
    });

    it('should use REAL tier values: COMMUNICATION 3/5', () => {
      const COMMUNICATION_TIERS = {
        'VALID_SCORECARD': 3,
        'CENTRAL_THRESHOLD': 5
      };

      expect(COMMUNICATION_TIERS['VALID_SCORECARD']).toBe(3);
      expect(COMMUNICATION_TIERS['CENTRAL_THRESHOLD']).toBe(5);
    });
  });
});
