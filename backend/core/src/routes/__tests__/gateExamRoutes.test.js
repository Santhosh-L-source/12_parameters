/**
 * GATE / Placement Exam Routes Tests
 *
 * Tests edge cases for tier computation logic
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('GATE / Placement Exam Routes', () => {
  let authToken;
  let studentRollNumber = '24CS360';

  beforeAll(async () => {
    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: studentRollNumber,
        password: '312324104001'
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
    }
  });

  afterAll(async () => {
    // Cleanup
    await sequelize.query(
      `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'gate'`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
  });

  describe('POST /api/gate/submit', () => {
    it('should submit GATE evidence successfully', async () => {
      const response = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2026,
          tests_completed: 10,
          average_score_percent: 45
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.exam_type).toBe('GATE');
      expect(response.body.evidence.is_bonus_exam).toBe(false);
    });

    it('should submit GRE bonus exam without core fields', async () => {
      const response = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GRE',
          exam_year: 2025,
          certificate_url: 'https://example.com/gre.pdf'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.exam_type).toBe('GRE');
      expect(response.body.evidence.is_bonus_exam).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/gate/submit')
        .send({
          exam_type: 'GATE',
          tests_completed: 5
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Edge Case: diagnostic_completed=true, tests_completed=2 -> 0 marks', () => {
    it('should award 0 marks (fails at least 3 tests requirement)', async () => {
      // Submit evidence
      const submitResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2024,
          diagnostic_completed: true,
          tests_completed: 2  // Less than 3
        });

      const evidenceId = submitResp.body.evidence.id;

      // Verify
      await request(app)
        .post(`/api/gate/${evidenceId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(0);  // Should be 0, not 3
    });
  });

  describe('Edge Case: tests_completed=10, average=39% -> 5 marks (not 10)', () => {
    it('should award 5 marks (average condition fails for 10-mark tier)', async () => {
      // Clean previous
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const submitResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2023,
          tests_completed: 10,
          average_score_percent: 39  // Less than 40%
        });

      await request(app)
        .post(`/api/gate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(5);  // Should be 5, not 10
    });
  });

  describe('Edge Case: tests_completed=15, full_length=2, average=55% -> 10 marks (not 15)', () => {
    it('should award 10 marks (full-length count fails for 15-mark tier)', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const submitResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2022,
          tests_completed: 15,
          full_length_tests: 2,  // Less than 3
          average_score_percent: 55
        });

      await request(app)
        .post(`/api/gate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(10);  // Should be 10, not 15
    });
  });

  describe('Edge Case: official_appearance=true, qualified=false -> 15 marks', () => {
    it('should award 15 marks from official appearance', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const submitResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2021,
          official_appearance: true,
          qualified: false
        });

      await request(app)
        .post(`/api/gate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(15);
    });
  });

  describe('Edge Case: gate_score=499 vs threshold=500 -> 20 marks (just under)', () => {
    it('should award 20 marks (qualified but under branch threshold)', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const submitResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2026,
          qualified: true,
          gate_score: 499,  // Just under threshold
          branch_code: 'CSE'
        });

      await request(app)
        .post(`/api/gate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(20);  // Should be 20, not 25
    });
  });

  describe('Edge Case: gate_score=500 vs threshold=500 -> 25 marks', () => {
    it('should award 25 marks (meets branch threshold exactly)', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const submitResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2026,
          gate_score: 500,  // Meets threshold
          branch_code: 'CSE'
        });

      await request(app)
        .post(`/api/gate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(25);
    });
  });

  describe('Edge Case: core=3, bonus valid -> bonus=0, final=3 (gated out)', () => {
    it('should not award bonus when core < 5', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit GATE with 3 marks
      const gateResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2020,
          diagnostic_completed: true,
          tests_completed: 3  // Exactly 3 marks
        });

      await request(app)
        .post(`/api/gate/${gateResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Submit TOEFL bonus
      const toeflResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'TOEFL',
          exam_year: 2020
        });

      await request(app)
        .post(`/api/gate/${toeflResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(3);
      expect(marksResp.body.bonus_marks).toBe(0);  // Gated out (core < 5)
      expect(marksResp.body.total_marks).toBe(3);
    });
  });

  describe('Edge Case: core=25, bonus +5 -> capped at 25 (not 30)', () => {
    it('should cap final marks at 25', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit GATE with 25 marks
      const gateResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2026,
          gate_score: 500,
          branch_code: 'CSE'
        });

      await request(app)
        .post(`/api/gate/${gateResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Submit IELTS bonus (+5)
      const ieltsResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'IELTS',
          exam_year: 2026
        });

      await request(app)
        .post(`/api/gate/${ieltsResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(25);
      expect(marksResp.body.bonus_marks).toBe(5);
      expect(marksResp.body.total_marks).toBe(25);  // Capped, not 30
    });
  });

  describe('Bonus Tiers', () => {
    it('should award +3 for GRE when core >= 5', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'gate'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Core = 5
      const gateResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2027,  // Use unique year
          tests_completed: 5
        });

      expect(gateResp.status).toBe(201);
      expect(gateResp.body.evidence).toBeDefined();

      await request(app)
        .post(`/api/gate/${gateResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Bonus +3
      const greResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exam_type: 'GRE', exam_year: 2027 });

      await request(app)
        .post(`/api/gate/${greResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(5);
      expect(marksResp.body.bonus_marks).toBe(3);
      expect(marksResp.body.total_marks).toBe(8);
    });

    it('should award +5 for TOEFL when core >= 5', async () => {
      await sequelize.query(
        `DELETE FROM gate_exam_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'gate'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Core = 10
      const gateResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          exam_type: 'GATE',
          exam_year: 2028,  // Use unique year
          tests_completed: 10,
          average_score_percent: 40
        });

      expect(gateResp.status).toBe(201);
      expect(gateResp.body.evidence).toBeDefined();

      await request(app)
        .post(`/api/gate/${gateResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Bonus +5
      const toeflResp = await request(app)
        .post('/api/gate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ exam_type: 'TOEFL', exam_year: 2028 });

      await request(app)
        .post(`/api/gate/${toeflResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marksResp = await request(app)
        .get(`/api/gate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.core_marks).toBe(10);
      expect(marksResp.body.bonus_marks).toBe(5);
      expect(marksResp.body.total_marks).toBe(15);
    });
  });

  describe('Branch Calibration Table', () => {
    it('should query gate_branch_calibration for 25-mark tier', async () => {
      const calibration = await sequelize.query(
        `SELECT * FROM gate_branch_calibration WHERE branch = 'CSE' AND year = 2026`,
        { type: sequelize.QueryTypes.SELECT }
      );

      expect(calibration.length).toBeGreaterThan(0);
      expect(parseFloat(calibration[0].threshold_score)).toBe(500);
    });
  });

  describe('GET /api/gate/student/:studentId', () => {
    it('should get all exam evidence for student', async () => {
      const response = await request(app)
        .get(`/api/gate/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });
});
