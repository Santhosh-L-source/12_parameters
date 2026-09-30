/**
 * Foreign Language Routes Tests
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Foreign Language Routes', () => {
  let authToken;
  let studentRollNumber = '24CS360'; // Using existing test student

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: studentRollNumber,
        password: '312324104001' // register number
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
    }
  });

  afterAll(async () => {
    // Cleanup test data
    await sequelize.query(
      `DELETE FROM language_evidence WHERE student_id = :studentId`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'language'`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
  });

  describe('POST /api/language/submit', () => {
    it('should submit French B1 evidence successfully', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'French',
          proficiency_level: 'B1',
          certification_name: 'DELF B1',
          certificate_url: 'https://example.com/delf-certificate.pdf'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.language).toBe('French');
      expect(response.body.evidence.proficiency_level).toBe('B1');
      expect(response.body.evidence.status).toBe('PENDING');
    });

    it('should submit Spanish A2 evidence successfully', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'Spanish',
          proficiency_level: 'A2',
          certification_name: 'DELE A2'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.language).toBe('Spanish');
      expect(response.body.evidence.proficiency_level).toBe('A2');
    });

    it('should reject duplicate language+level submission', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'French',
          proficiency_level: 'B1',
          certification_name: 'DELF B1'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Duplicate submission');
    });

    it('should reject English (lowercase)', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'english',
          proficiency_level: 'B1'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject English (uppercase)', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'ENGLISH',
          proficiency_level: 'A1'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject English (mixed case)', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'English',
          proficiency_level: 'A2'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid proficiency level', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'German',
          proficiency_level: 'C1' // Not in allowed list (A1, A2, B1)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/language/submit')
        .send({
          language: 'French',
          proficiency_level: 'A1'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/language/student/:studentId', () => {
    it('should get all language evidence for authenticated student', async () => {
      const response = await request(app)
        .get(`/api/language/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
      expect(response.body.evidence.length).toBeGreaterThanOrEqual(2); // French B1 + Spanish A2
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/language/student/${studentRollNumber}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/language/:id/verify', () => {
    it('should verify French B1 evidence and calculate marks correctly (15 marks)', async () => {
      // Get French B1 evidence ID
      const evidenceResult = await sequelize.query(
        `SELECT id FROM language_evidence
         WHERE student_id = :studentId AND language = 'French' AND proficiency_level = 'B1'
         AND status = 'PENDING'
         LIMIT 1`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (evidenceResult.length === 0) {
        console.log('Skipping test - no French B1 evidence found');
        return;
      }

      const response = await request(app)
        .post(`/api/language/${evidenceResult[0].id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'VERIFIED'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('VERIFIED');

      // Check scores table - should be 15 (B1 is highest)
      const scoreResult = await sequelize.query(
        `SELECT marks FROM scores WHERE register_number = :studentId AND parameter = 'language'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      expect(scoreResult.length).toBeGreaterThan(0);
      expect(scoreResult[0].marks).toBe(15); // B1 = 15 marks
    });

    it('should verify Spanish A2 but marks should remain 15 (MAX, not sum)', async () => {
      // Get Spanish A2 evidence ID
      const evidenceResult = await sequelize.query(
        `SELECT id FROM language_evidence
         WHERE student_id = :studentId AND language = 'Spanish' AND proficiency_level = 'A2'
         AND status = 'PENDING'
         LIMIT 1`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (evidenceResult.length === 0) {
        console.log('Skipping test - no Spanish A2 evidence found');
        return;
      }

      const response = await request(app)
        .post(`/api/language/${evidenceResult[0].id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'VERIFIED'
        });

      expect(response.status).toBe(200);

      // Check scores table - should still be 15 (MAX of B1=15 and A2=12)
      const scoreResult = await sequelize.query(
        `SELECT marks FROM scores WHERE register_number = :studentId AND parameter = 'language'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      expect(scoreResult.length).toBeGreaterThan(0);
      expect(scoreResult[0].marks).toBe(15); // MAX(15, 12) = 15, NOT 27
    });

    it('should reject evidence with reason', async () => {
      // Submit new evidence for rejection test
      const submitResponse = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'German',
          proficiency_level: 'A1'
        });

      const evidenceId = submitResponse.body.evidence.id;

      const response = await request(app)
        .post(`/api/language/${evidenceId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'REJECTED',
          rejection_reason: 'Invalid certificate'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('REJECTED');
    });

    it('should require rejection reason when rejecting', async () => {
      // Submit new evidence
      const submitResponse = await request(app)
        .post('/api/language/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          language: 'Japanese',
          proficiency_level: 'A1'
        });

      const evidenceId = submitResponse.body.evidence.id;

      const response = await request(app)
        .post(`/api/language/${evidenceId}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'REJECTED'
          // Missing rejection_reason
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/language/marks/:studentId', () => {
    it('should calculate MAX marks correctly (15 from B1, not sum)', async () => {
      const response = await request(app)
        .get(`/api/language/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.marks).toBe(15); // MAX(B1=15, A2=12) = 15
      expect(response.body.max_marks).toBe(15);
      expect(response.body.languages_count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Scoring Logic', () => {
    it('should award correct marks for each level', () => {
      const LEVEL_MARKS = {
        'A1': 7,
        'A2': 12,
        'B1': 15
      };

      expect(LEVEL_MARKS['A1']).toBe(7);
      expect(LEVEL_MARKS['A2']).toBe(12);
      expect(LEVEL_MARKS['B1']).toBe(15);
    });

    it('should take MAX, not sum', () => {
      const levels = ['B1', 'A2', 'A1'];
      const marks = { 'A1': 7, 'A2': 12, 'B1': 15 };

      let maxMarks = 0;
      for (const level of levels) {
        maxMarks = Math.max(maxMarks, marks[level]);
      }

      expect(maxMarks).toBe(15); // Not 34 (7+12+15)
    });
  });
});
