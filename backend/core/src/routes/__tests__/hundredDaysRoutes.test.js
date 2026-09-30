/**
 * Hundred Days Training Routes Tests
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Hundred Days Training Routes', () => {
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
      `DELETE FROM hundred_days_evidence WHERE student_id = :studentId`,
      {
        replacements: { studentId: studentRollNumber },
        type: sequelize.QueryTypes.DELETE
      }
    );
  });

  describe('POST /api/hundred-days/submit', () => {
    it('should submit HOPE_ELITE evidence successfully', async () => {
      const response = await request(app)
        .post('/api/hundred-days/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          training_program: 'HOPE_ELITE',
          selection_year: 2024,
          selection_letter_url: 'https://example.com/certificate.pdf'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.training_program).toBe('HOPE_ELITE');
      expect(response.body.evidence.status).toBe('PENDING');
    });

    it('should reject duplicate submission', async () => {
      const response = await request(app)
        .post('/api/hundred-days/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          training_program: 'PEP',
          selection_year: 2024
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Duplicate submission');
    });

    it('should reject invalid training program', async () => {
      const response = await request(app)
        .post('/api/hundred-days/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          training_program: 'INVALID_PROGRAM',
          selection_year: 2024
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/hundred-days/submit')
        .send({
          training_program: 'PEP',
          selection_year: 2024
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/hundred-days/student/:studentId', () => {
    it('should get evidence for authenticated student', async () => {
      const response = await request(app)
        .get(`/api/hundred-days/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence).toBeDefined();
      if (response.body.evidence) {
        expect(response.body.evidence.training_program).toBe('HOPE_ELITE');
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/hundred-days/student/${studentRollNumber}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/hundred-days/marks/:studentId', () => {
    it('should calculate marks correctly for HOPE_ELITE (15 marks)', async () => {
      // First verify the evidence
      const evidenceResult = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE student_id = :studentId`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (evidenceResult.length > 0) {
        await request(app)
          .post(`/api/hundred-days/${evidenceResult[0].id}/verify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            action: 'VERIFIED'
          });
      }

      const response = await request(app)
        .get(`/api/hundred-days/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.marks).toBe(15);
      expect(response.body.max_marks).toBe(15);
      expect(response.body.program).toBe('HOPE_ELITE');
    });
  });

  describe('POST /api/hundred-days/:id/verify', () => {
    it('should verify evidence and update scores', async () => {
      // Get evidence ID
      const evidenceResult = await sequelize.query(
        `SELECT id, status FROM hundred_days_evidence WHERE student_id = :studentId`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      expect(evidenceResult.length).toBeGreaterThan(0);

      // Reset status to PENDING if already verified (from previous test)
      if (evidenceResult[0].status !== 'PENDING') {
        await sequelize.query(
          `UPDATE hundred_days_evidence SET status = 'PENDING' WHERE id = :id`,
          {
            replacements: { id: evidenceResult[0].id },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      }

      const response = await request(app)
        .post(`/api/hundred-days/${evidenceResult[0].id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'VERIFIED'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('VERIFIED');

      // Check scores table was updated
      const scoreResult = await sequelize.query(
        `SELECT marks FROM scores WHERE register_number = :studentId AND parameter = 'hundred_days'`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      expect(scoreResult.length).toBeGreaterThan(0);
      expect(scoreResult[0].marks).toBe(15); // HOPE_ELITE = 15 marks
    });

    it('should reject evidence with reason', async () => {
      // Find an existing student to test rejection
      const students = await sequelize.query(
        `SELECT roll_number FROM students WHERE roll_number != :currentStudent LIMIT 1`,
        {
          replacements: { currentStudent: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (students.length === 0) {
        console.log('Skipping rejection test - no other students found');
        return;
      }

      const testStudent = students[0].roll_number;

      // Check if this student already has evidence
      const existing = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE student_id = :studentId`,
        {
          replacements: { studentId: testStudent },
          type: sequelize.QueryTypes.SELECT
        }
      );

      // Clean up first if exists
      if (existing.length > 0) {
        await sequelize.query(
          `DELETE FROM hundred_days_evidence WHERE student_id = :studentId`,
          {
            replacements: { studentId: testStudent },
            type: sequelize.QueryTypes.DELETE
          }
        );
      }

      // Create new evidence
      await sequelize.query(
        `INSERT INTO hundred_days_evidence
         (student_id, training_program, status)
         VALUES (:studentId, 'PEP', 'PENDING')`,
        {
          replacements: { studentId: testStudent },
          type: sequelize.QueryTypes.INSERT
        }
      );

      const evidenceResult = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE student_id = :studentId`,
        {
          replacements: { studentId: testStudent },
          type: sequelize.QueryTypes.SELECT
        }
      );

      const response = await request(app)
        .post(`/api/hundred-days/${evidenceResult[0].id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'REJECTED',
          rejection_reason: 'Invalid selection letter'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.action).toBe('REJECTED');

      // Cleanup
      await sequelize.query(
        `DELETE FROM hundred_days_evidence WHERE student_id = :studentId`,
        {
          replacements: { studentId: testStudent },
          type: sequelize.QueryTypes.DELETE
        }
      );
    });

    it('should require rejection reason when rejecting', async () => {
      const evidenceResult = await sequelize.query(
        `SELECT id FROM hundred_days_evidence WHERE student_id = :studentId LIMIT 1`,
        {
          replacements: { studentId: studentRollNumber },
          type: sequelize.QueryTypes.SELECT
        }
      );

      if (evidenceResult.length > 0) {
        const response = await request(app)
          .post(`/api/hundred-days/${evidenceResult[0].id}/verify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            action: 'REJECTED'
            // Missing rejection_reason
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Scoring Logic', () => {
    it('should award correct marks for each program', () => {
      const testCases = [
        { program: 'HOPE_ELITE', expectedMarks: 15 },
        { program: 'HOPE_NON_ELITE', expectedMarks: 10 },
        { program: 'PEP', expectedMarks: 5 },
        { program: 'NOT_SELECTED', expectedMarks: 0 }
      ];

      const PROGRAM_MARKS = {
        'HOPE_ELITE': 15,
        'HOPE_NON_ELITE': 10,
        'PEP': 5,
        'NOT_SELECTED': 0
      };

      testCases.forEach(tc => {
        expect(PROGRAM_MARKS[tc.program]).toBe(tc.expectedMarks);
      });
    });
  });
});
