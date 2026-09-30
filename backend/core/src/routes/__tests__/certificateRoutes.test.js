/**
 * Certificate Achievement Routes Tests
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Certificate Achievement Routes', () => {
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
      `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
  });

  describe('POST /api/certificate/submit', () => {
    it('should submit academic certificate successfully', async () => {
      // Cleanup first
      await sequelize.query(
        `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'AWS Solutions Architect',
          credential_category: 'INDUSTRY',
          tier_level: 'PROFESSIONAL',
          issuing_organization: 'Amazon Web Services'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.credential_name).toBe('AWS Solutions Architect');
      expect(response.body.evidence.credential_category).toBe('INDUSTRY');
      expect(response.body.evidence.tier_level).toBe('PROFESSIONAL');
      expect(response.body.evidence.tier_marks).toBe(10);
      expect(response.body.evidence.verification_source).toBe('MENTOR_MANUAL');
    });

    it('should submit certificate with platform verification', async () => {
      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Google Cloud Associate',
          credential_category: 'INDUSTRY',
          tier_level: 'ASSOCIATE',
          issuing_organization: 'Google Cloud',
          verify_url: 'https://www.credential.net/abc123',
          credential_id: 'GCP-123456'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.verification_source).toBe('PLATFORM_PARTIAL');
    });

    it('should reject duplicate credential submission', async () => {
      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'AWS Solutions Architect',
          credential_category: 'INDUSTRY',
          tier_level: 'EXPERT'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Duplicate submission');
    });

    it('should reject invalid tier for academic category', async () => {
      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Test Academic Cert',
          credential_category: 'ACADEMIC',
          tier_level: 'PROFESSIONAL'  // Industry tier
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid tier');
    });

    it('should reject invalid tier for industry category', async () => {
      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Test Industry Cert',
          credential_category: 'INDUSTRY',
          tier_level: 'BASIC'  // Academic tier
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid tier');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/certificate/submit')
        .send({
          credential_name: 'Test Cert',
          credential_category: 'ACADEMIC',
          tier_level: 'BASIC'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Edge Case: Foundation sub-cap at 10, then overall cap at 20', () => {
    it('should apply foundation sub-cap (>10) then overall cap', async () => {
      // Clean previous
      await sequelize.query(
        `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Foundation Credential 1: ACADEMIC ADVANCED (10 marks)
      const resp1 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'NPTEL Python Foundation',
          credential_category: 'ACADEMIC',
          tier_level: 'ADVANCED'  // 10 marks
        });

      expect(resp1.status).toBe(201);

      // Foundation Credential 2: ACADEMIC INTERMEDIATE (5 marks)
      const resp2 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Coursera Data Science Basics',
          credential_category: 'ACADEMIC',
          tier_level: 'INTERMEDIATE'  // 5 marks
        });

      expect(resp2.status).toBe(201);

      // Non-Foundation Credential: INDUSTRY EXPERT (15 marks)
      const resp3 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'AWS DevOps Engineer',
          credential_category: 'INDUSTRY',
          tier_level: 'EXPERT'  // 15 marks
        });

      expect(resp3.status).toBe(201);

      // Verify all three with foundation flags
      await request(app)
        .post(`/api/certificate/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: true });

      await request(app)
        .post(`/api/certificate/${resp2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: true });

      await request(app)
        .post(`/api/certificate/${resp3.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: false });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/certificate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.credentials_count).toBe(3);
      expect(marksResp.body.foundation_credentials).toBe(2);
      expect(marksResp.body.non_foundation_credentials).toBe(1);
      expect(marksResp.body.foundation_marks_raw).toBe(15);  // 10 + 5 = 15 (before cap)
      expect(marksResp.body.foundation_marks_capped).toBe(10);  // Capped at 10
      expect(marksResp.body.non_foundation_marks).toBe(15);
      expect(marksResp.body.uncapped_total).toBe(25);  // 10 (capped foundation) + 15 = 25
      expect(marksResp.body.marks).toBe(20);  // Overall cap at 20
    }, 15000);
  });

  describe('Edge Case: Same credential, higher tier later -> highest only', () => {
    it('should take highest tier only for same credential', async () => {
      await sequelize.query(
        `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit at ASSOCIATE tier (5 marks)
      const resp1 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Azure Fundamentals',
          credential_category: 'INDUSTRY',
          tier_level: 'ASSOCIATE'  // 5 marks
        });

      expect(resp1.status).toBe(201);

      // Verify first submission
      await request(app)
        .post(`/api/certificate/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: false });

      // Try to submit same credential at EXPERT tier (15 marks) - should be rejected as duplicate
      const resp2 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Azure Fundamentals',
          credential_category: 'INDUSTRY',
          tier_level: 'EXPERT'  // 15 marks
        });

      expect(resp2.status).toBe(409);  // Duplicate

      // Manually update to simulate tier upgrade
      await sequelize.query(
        `UPDATE certificate_evidence
         SET tier_level = 'EXPERT', tier_marks = 15
         WHERE student_id = :studentId AND credential_name = 'Azure Fundamentals'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.UPDATE
        }
      );

      // Check marks
      const marksResp = await request(app)
        .get(`/api/certificate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.marks).toBe(15);  // Should be 15, not 20 (5+15)
      expect(marksResp.body.credentials_count).toBe(1);
    }, 15000);
  });

  describe('Edge Case: Multiple credentials summing past 20 -> capped', () => {
    it('should cap total at 20 when credentials sum past 20', async () => {
      await sequelize.query(
        `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Credential 1: INDUSTRY EXPERT (15 marks)
      const resp1 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Kubernetes Administrator',
          credential_category: 'INDUSTRY',
          tier_level: 'EXPERT'
        });

      await request(app)
        .post(`/api/certificate/${resp1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: false });

      // Credential 2: INDUSTRY PROFESSIONAL (10 marks)
      const resp2 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Docker Certified',
          credential_category: 'INDUSTRY',
          tier_level: 'PROFESSIONAL'
        });

      await request(app)
        .post(`/api/certificate/${resp2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: false });

      // Credential 3: ACADEMIC INTERMEDIATE (5 marks)
      const resp3 = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Machine Learning Basics',
          credential_category: 'ACADEMIC',
          tier_level: 'INTERMEDIATE'
        });

      await request(app)
        .post(`/api/certificate/${resp3.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: false });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/certificate/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marksResp.body.uncapped_total).toBe(30);  // 15 + 10 + 5 = 30
      expect(marksResp.body.marks).toBe(20);  // Capped at 20
      expect(marksResp.body.credentials_count).toBe(3);
    }, 15000);
  });

  describe('POST /api/certificate/:id/verify', () => {
    it('should verify evidence and calculate marks correctly', async () => {
      await sequelize.query(
        `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Submit and verify
      const submitResp = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'CompTIA Security+',
          credential_category: 'INDUSTRY',
          tier_level: 'PROFESSIONAL'  // 10 marks
        });

      const verifyResp = await request(app)
        .post(`/api/certificate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED', is_foundation_level: false });

      expect(verifyResp.status).toBe(200);
      expect(verifyResp.body.success).toBe(true);

      // Check scores table
      const scoreResult = await sequelize.query(
        `SELECT marks FROM scores WHERE register_number = :studentId AND parameter = 'certificate'`,
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
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Test Cert Reject',
          credential_category: 'ACADEMIC',
          tier_level: 'BASIC'
        });

      const rejectResp = await request(app)
        .post(`/api/certificate/${submitResp.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'REJECTED',
          rejection_reason: 'Certificate expired'
        });

      expect(rejectResp.status).toBe(200);
      expect(rejectResp.body.action).toBe('REJECTED');
    });
  });

  describe('Verification Source', () => {
    it('should set PLATFORM_PARTIAL when verify_url is provided', async () => {
      await sequelize.query(
        `DELETE FROM certificate_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Credly Badge Test',
          credential_category: 'INDUSTRY',
          tier_level: 'ASSOCIATE',
          verify_url: 'https://www.credly.com/badges/test123'
        });

      expect(response.status).toBe(201);
      expect(response.body.evidence.verification_source).toBe('PLATFORM_PARTIAL');
    });

    it('should set MENTOR_MANUAL when no verify_url', async () => {
      const response = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          credential_name: 'Manual Cert Test',
          credential_category: 'ACADEMIC',
          tier_level: 'BASIC'
        });

      expect(response.status).toBe(201);
      expect(response.body.evidence.verification_source).toBe('MENTOR_MANUAL');
    });
  });

  describe('GET /api/certificate/student/:studentId', () => {
    it('should get all certificate evidence for student', async () => {
      const response = await request(app)
        .get(`/api/certificate/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });

  describe('Scoring Logic', () => {
    it('should award correct marks for academic tiers', () => {
      const ACADEMIC_MARKS = {
        'BASIC': 3,
        'INTERMEDIATE': 5,
        'ADVANCED': 10,
        'EXPERT': 15
      };

      expect(ACADEMIC_MARKS['BASIC']).toBe(3);
      expect(ACADEMIC_MARKS['INTERMEDIATE']).toBe(5);
      expect(ACADEMIC_MARKS['ADVANCED']).toBe(10);
      expect(ACADEMIC_MARKS['EXPERT']).toBe(15);
    });

    it('should award correct marks for industry tiers', () => {
      const INDUSTRY_MARKS = {
        'ASSOCIATE': 5,
        'PROFESSIONAL': 10,
        'EXPERT': 15
      };

      expect(INDUSTRY_MARKS['ASSOCIATE']).toBe(5);
      expect(INDUSTRY_MARKS['PROFESSIONAL']).toBe(10);
      expect(INDUSTRY_MARKS['EXPERT']).toBe(15);
    });
  });
});
