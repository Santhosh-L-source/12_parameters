const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Monthly Coding Assessment Routes', () => {
  let authToken;
  const studentRollNumber = '24CS360';

  beforeAll(async () => {
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
    await sequelize.query(
      `DELETE FROM monthly_coding_evidence WHERE student_id = :studentId`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'monthly_coding'`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
  });

  describe('POST /api/monthly-coding/submit', () => {
    it('should submit monthly coding assessment successfully', async () => {
      const res = await request(app)
        .post('/api/monthly-coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          semester: 2,
          month: 'February',
          year: 2025,
          percentage: 85.5,
          problems_solved: 4,
          total_problems: 5,
          platform: 'Skillrack',
          proof_url: 'https://skillrack.com/profile/test'
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid percentage (>100)', async () => {
      const res = await request(app)
        .post('/api/monthly-coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          semester: 2,
          month: 'March',
          year: 2025,
          percentage: 150
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/monthly-coding/marks/:studentId', () => {
    it('should compute marks based on average percentage tiers', async () => {
      const res = await request(app)
        .get(`/api/monthly-coding/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.max_marks).toBe(20);
      expect(typeof res.body.marks).toBe('number');
    });
  });
});
