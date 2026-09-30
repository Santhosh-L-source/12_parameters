const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Project / Publication / Patent Routes', () => {
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
      `DELETE FROM project_evidence WHERE student_id = :studentId`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'project'`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
  });

  describe('POST /api/evidence/project-pub-patent', () => {
    it('should submit project evidence successfully', async () => {
      const res = await request(app)
        .post('/api/evidence/project-pub-patent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          semester: 4,
          achievement_type: 'PROJECT',
          output_name: 'Autonomous Drone Navigation System',
          achievement_stage: 'WORKING_PROTOTYPE',
          stage_marks: 10,
          proof_url: 'https://github.com/test/drone-nav'
        });

      expect([200, 201, 409]).toContain(res.status);
    });
  });

  describe('GET /api/project-pub-patent/marks/:studentId', () => {
    it('should calculate marks capped at 30', async () => {
      const res = await request(app)
        .get(`/api/project-pub-patent/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.max_marks).toBe(30);
      expect(typeof res.body.marks).toBe('number');
      expect(res.body.marks).toBeLessThanOrEqual(30);
    });
  });
});
