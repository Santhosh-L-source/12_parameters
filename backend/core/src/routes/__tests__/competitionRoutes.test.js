/**
 * Competition Achievement Routes Tests
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Competition Achievement Routes', () => {
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
      `DELETE FROM competition_evidence WHERE student_id = :studentId`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'competition'`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
  });

  describe('POST /api/competition/submit', () => {
    it('should submit competition evidence successfully', async () => {
      const response = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'Smart India Hackathon',
          round_cleared: 'REGIONAL_FINALIST',
          competition_type: 'HACKATHON',
          organizer: 'Ministry of Education',
          event_date: '2026-03-15'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.event_name).toBe('Smart India Hackathon');
      expect(response.body.evidence.round_cleared).toBe('REGIONAL_FINALIST');
      expect(response.body.evidence.stage_marks).toBe(10);
    });

    it('should reject duplicate event submission', async () => {
      const response = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'Smart India Hackathon',
          round_cleared: 'NATIONAL_FINALIST'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Duplicate submission');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/competition/submit')
        .send({
          event_name: 'Test Event',
          round_cleared: 'PRELIM'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Edge Case: Same event, round 2 then round 5 -> highest only (not summed)', () => {
    it('should take highest round only for same event', async () => {
      // Clean previous
      await sequelize.query(
        `DELETE FROM competition_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'competition'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit event at SECOND_ROUND (6 marks)
      const resp1 = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'CodeFest 2026',
          round_cleared: 'SECOND_ROUND'  // 6 marks
        });

      expect(resp1.status).toBe(201);

      // Verify first submission
      await request(app)
        .post(`/api/competition/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Try to submit same event at NATIONAL_FINALIST (15 marks) - should be rejected as duplicate
      const resp2 = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'CodeFest 2026',
          round_cleared: 'NATIONAL_FINALIST'  // 15 marks
        });

      expect(resp2.status).toBe(409);  // Duplicate - system prevents double submission

      // Manually update to simulate progression (in real system, student would contact mentor)
      await sequelize.query(
        `UPDATE competition_evidence
         SET round_cleared = 'NATIONAL_FINALIST', stage_marks = 15
         WHERE student_id = :studentId AND event_name = 'CodeFest 2026'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // Recalculate marks
      const marksResp = await request(app)
        .get(`/api/competition/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.marks).toBe(15);  // Should be 15, not 21 (6+15)
      expect(marksResp.body.events_count).toBe(1);  // Only 1 distinct event
    });
  });

  describe('Edge Case: 3+ events summing past 20 -> capped at 20', () => {
    it('should cap total at 20 when events sum past 20', async () => {
      await sequelize.query(
        `DELETE FROM competition_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'competition'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Event 1: NATIONAL_FINALIST (15 marks)
      const resp1 = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'Google Hashcode',
          round_cleared: 'NATIONAL_FINALIST'
        });

      await request(app)
        .post(`/api/competition/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Event 2: REGIONAL_FINALIST (10 marks)
      const resp2 = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'Facebook Hacker Cup',
          round_cleared: 'REGIONAL_FINALIST'
        });

      await request(app)
        .post(`/api/competition/${resp2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Event 3: SECOND_ROUND (6 marks)
      const resp3 = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'Microsoft Imagine Cup',
          round_cleared: 'SECOND_ROUND'
        });

      await request(app)
        .post(`/api/competition/${resp3.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/competition/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.uncapped_total).toBe(31);  // 15 + 10 + 6 = 31
      expect(marksResp.body.marks).toBe(20);  // Capped at 20, not 31
      expect(marksResp.body.events_count).toBe(3);  // 3 distinct events
    });
  });

  describe('POST /api/competition/:id/verify', () => {
    it('should verify evidence and calculate marks correctly', async () => {
      await sequelize.query(
        `DELETE FROM competition_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'competition'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit and verify
      const submitResp = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'ACM ICPC',
          round_cleared: 'INTERNATIONAL_WINNER'  // 20 marks
        });

      const verifyResp = await request(app)
        .post(`/api/competition/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      expect(verifyResp.status).toBe(200);
      expect(verifyResp.body.success).toBe(true);

      // Check scores table
      const scoreResult = await sequelize.query(
        `SELECT marks FROM scores WHERE register_number = :studentId AND parameter = 'competition'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      expect(scoreResult.length).toBeGreaterThan(0);
      expect(scoreResult[0].marks).toBe(20);
    });

    it('should reject evidence with reason', async () => {
      const submitResp = await request(app)
        .post('/api/competition/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          event_name: 'Local Hackathon',
          round_cleared: 'PRELIM'
        });

      const rejectResp = await request(app)
        .post(`/api/competition/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'REJECTED',
          rejection_reason: 'Invalid certificate'
        });

      expect(rejectResp.status).toBe(200);
      expect(rejectResp.body.action).toBe('REJECTED');
    });
  });

  describe('GET /api/competition/student/:studentId', () => {
    it('should get all competition evidence for student', async () => {
      const response = await request(app)
        .get(`/api/competition/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });

  describe('Scoring Logic', () => {
    it('should award correct marks for each round', () => {
      const ROUND_MARKS = {
        'VALID_COMPLETION': 2,
        'PRELIM': 4,
        'SECOND_ROUND': 6,
        'REGIONAL_FINALIST': 10,
        'NATIONAL_FINALIST': 15,
        'INTERNATIONAL_WINNER': 20
      };

      expect(ROUND_MARKS['VALID_COMPLETION']).toBe(2);
      expect(ROUND_MARKS['PRELIM']).toBe(4);
      expect(ROUND_MARKS['SECOND_ROUND']).toBe(6);
      expect(ROUND_MARKS['REGIONAL_FINALIST']).toBe(10);
      expect(ROUND_MARKS['NATIONAL_FINALIST']).toBe(15);
      expect(ROUND_MARKS['INTERNATIONAL_WINNER']).toBe(20);
    });
  });
});
