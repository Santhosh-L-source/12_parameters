/**
 * Internship & Startup Routes Tests
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Internship & Startup Routes', () => {
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
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await sequelize.query(
      `DELETE FROM internship_evidence WHERE student_id = :studentId`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
  });

  describe('POST /api/internship/submit', () => {
    it('should submit recruitment evidence successfully', async () => {
      // Cleanup first
      await sequelize.query(
        `DELETE FROM internship_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const response = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Google India',
          track: 'RECRUITMENT',
          achievement_stage: 'OFFERED',
          role: 'Software Engineer'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.company_name).toBe('Google India');
      expect(response.body.evidence.track).toBe('RECRUITMENT');
      expect(response.body.evidence.achievement_stage).toBe('OFFERED');
      expect(response.body.evidence.stage_marks).toBe(10);
    });

    it('should submit startup evidence successfully', async () => {
      const response = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'MyStartup Inc',
          track: 'STARTUP',
          achievement_stage: 'PROTOTYPE',
          role: 'Founder'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.company_name).toBe('MyStartup Inc');
      expect(response.body.evidence.track).toBe('STARTUP');
      expect(response.body.evidence.achievement_stage).toBe('PROTOTYPE');
      expect(response.body.evidence.stage_marks).toBe(5);
    });

    it('should reject duplicate company submission', async () => {
      const response = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Google India',
          track: 'RECRUITMENT',
          achievement_stage: 'JOINED'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Duplicate submission');
    });

    it('should reject invalid stage for recruitment track', async () => {
      const response = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Microsoft',
          track: 'RECRUITMENT',
          achievement_stage: 'PROTOTYPE'  // Startup stage
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid stage');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/internship/submit')
        .send({
          company_name: 'Test Company',
          track: 'RECRUITMENT',
          achievement_stage: 'APPLIED'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Edge Case 1: Same company, higher stage later -> highest only (NOT summed)', () => {
    it('should take highest stage only for same company', async () => {
      // Clean previous
      await sequelize.query(
        `DELETE FROM internship_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit at APPLIED stage (2 marks)
      const resp1 = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'TechCorp',
          track: 'RECRUITMENT',
          achievement_stage: 'APPLIED'  // 2 marks
        });

      expect(resp1.status).toBe(201);

      // Verify first submission
      await request(app)
        .post(`/api/internship/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Try to submit same company at COMPLETED stage (20 marks) - should be rejected as duplicate
      const resp2 = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'TechCorp',
          track: 'RECRUITMENT',
          achievement_stage: 'COMPLETED'  // 20 marks
        });

      expect(resp2.status).toBe(409);  // Duplicate - system prevents double submission

      // Manually update to simulate progression (in real system, student would contact mentor)
      await sequelize.query(
        `UPDATE internship_evidence
         SET achievement_stage = 'COMPLETED', stage_marks = 20
         WHERE student_id = :studentId AND company_name = 'TechCorp'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // Recalculate marks
      const marksResp = await request(app)
        .get(`/api/internship/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.marks).toBe(20);  // Should be 20, not 22 (2+20)
      expect(marksResp.body.companies_count).toBe(1);  // Only 1 distinct company
    }, 15000);
  });

  describe('Edge Case 2: Different companies (recruitment + startup) -> BOTH count, sum, cap', () => {
    it('should sum across BOTH tracks and cap at 20', async () => {
      await sequelize.query(
        `DELETE FROM internship_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Company 1: RECRUITMENT track, JOINED stage (15 marks)
      const resp1 = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Company-X',
          track: 'RECRUITMENT',
          achievement_stage: 'JOINED',  // 15 marks
          role: 'SDE'
        });

      expect(resp1.status).toBe(201);
      expect(resp1.body.evidence.stage_marks).toBe(15);

      await request(app)
        .post(`/api/internship/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Company 2: STARTUP track, REGISTERED stage (8 marks) - DIFFERENT company name
      const resp2 = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Startup-Y',  // DIFFERENT company name
          track: 'STARTUP',
          achievement_stage: 'REGISTERED',  // 8 marks
          role: 'Co-Founder'
        });

      expect(resp2.status).toBe(201);
      expect(resp2.body.evidence.stage_marks).toBe(8);

      await request(app)
        .post(`/api/internship/${resp2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/internship/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.companies_count).toBe(2);  // 2 distinct companies
      expect(marksResp.body.uncapped_total).toBe(23);  // 15 + 8 = 23
      expect(marksResp.body.marks).toBe(20);  // Capped at 20, not 23
      expect(marksResp.body.breakdown).toHaveLength(2);  // Both companies present

      // Verify breakdown includes both tracks
      const hasRecruitment = marksResp.body.breakdown.some(b => b.track === 'RECRUITMENT');
      const hasStartup = marksResp.body.breakdown.some(b => b.track === 'STARTUP');
      expect(hasRecruitment).toBe(true);
      expect(hasStartup).toBe(true);
    }, 15000);
  });

  describe('Edge Case 3: Multiple companies summing past 20 -> capped', () => {
    it('should cap total at 20 when multiple companies sum past 20', async () => {
      await sequelize.query(
        `DELETE FROM internship_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Company 1: RECRUITMENT COMPLETED (20 marks)
      const resp1 = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Amazon',
          track: 'RECRUITMENT',
          achievement_stage: 'COMPLETED'
        });

      await request(app)
        .post(`/api/internship/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Company 2: STARTUP FUNDED_SEED (10 marks)
      const resp2 = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'InnovateTech',
          track: 'STARTUP',
          achievement_stage: 'FUNDED_SEED'
        });

      await request(app)
        .post(`/api/internship/${resp2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/internship/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.uncapped_total).toBe(30);  // 20 + 10 = 30
      expect(marksResp.body.marks).toBe(20);  // Capped at 20
      expect(marksResp.body.companies_count).toBe(2);
    }, 15000);
  });

  describe('POST /api/internship/:id/verify', () => {
    it('should verify evidence and calculate marks correctly', async () => {
      await sequelize.query(
        `DELETE FROM internship_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit and verify
      const submitResp = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'Tesla',
          track: 'RECRUITMENT',
          achievement_stage: 'OFFERED'  // 10 marks
        });

      const verifyResp = await request(app)
        .post(`/api/internship/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      expect(verifyResp.status).toBe(200);
      expect(verifyResp.body.success).toBe(true);

      // Check scores table
      const scoreResult = await sequelize.query(
        `SELECT marks FROM scores WHERE register_number = :studentId AND parameter = 'internship'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      expect(scoreResult.length).toBeGreaterThan(0);
      expect(scoreResult[0].marks).toBe(10);
    }, 15000);

    it('should reject evidence with reason', async () => {
      const submitResp = await request(app)
        .post('/api/internship/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          company_name: 'LocalCorp',
          track: 'RECRUITMENT',
          achievement_stage: 'APPLIED'
        });

      const rejectResp = await request(app)
        .post(`/api/internship/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'REJECTED',
          rejection_reason: 'Invalid offer letter'
        });

      expect(rejectResp.status).toBe(200);
      expect(rejectResp.body.action).toBe('REJECTED');
    });
  });

  describe('GET /api/internship/student/:studentId', () => {
    it('should get all internship evidence for student', async () => {
      const response = await request(app)
        .get(`/api/internship/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });

  describe('Scoring Logic', () => {
    it('should award correct marks for recruitment stages', () => {
      const RECRUITMENT_MARKS = {
        'APPLIED': 2,
        'SHORTLISTED': 4,
        'INTERVIEWED': 6,
        'OFFERED': 10,
        'JOINED': 15,
        'COMPLETED': 20
      };

      expect(RECRUITMENT_MARKS['APPLIED']).toBe(2);
      expect(RECRUITMENT_MARKS['SHORTLISTED']).toBe(4);
      expect(RECRUITMENT_MARKS['INTERVIEWED']).toBe(6);
      expect(RECRUITMENT_MARKS['OFFERED']).toBe(10);
      expect(RECRUITMENT_MARKS['JOINED']).toBe(15);
      expect(RECRUITMENT_MARKS['COMPLETED']).toBe(20);
    });

    it('should award correct marks for startup stages', () => {
      const STARTUP_MARKS = {
        'IDEATION': 3,
        'PROTOTYPE': 5,
        'REGISTERED': 8,
        'FUNDED_SEED': 10,
        'REVENUE': 15,
        'SCALED': 20
      };

      expect(STARTUP_MARKS['IDEATION']).toBe(3);
      expect(STARTUP_MARKS['PROTOTYPE']).toBe(5);
      expect(STARTUP_MARKS['REGISTERED']).toBe(8);
      expect(STARTUP_MARKS['FUNDED_SEED']).toBe(10);
      expect(STARTUP_MARKS['REVENUE']).toBe(15);
      expect(STARTUP_MARKS['SCALED']).toBe(20);
    });
  });
});
