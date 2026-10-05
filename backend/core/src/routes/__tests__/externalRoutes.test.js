const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');
const crypto = require('crypto');

describe('External Integration API Routes (/api/v1/external)', () => {
  const testApiKey = 'hope_partner_live_key_2026';
  const testStudentRoll = '24CS422';

  beforeAll(async () => {
    // Ensure test API key exists in database
    const keyHash = crypto.createHash('sha256').update(testApiKey).digest('hex');
    await sequelize.query(`
      INSERT INTO api_keys (key_id, client_name, key_hash, is_active)
      VALUES ('PARTNER_TEST', 'Test ERP Partner', :keyHash, true)
      ON CONFLICT (key_id) DO UPDATE SET key_hash = :keyHash;
    `, { replacements: { keyHash } });

    // Ensure sample student exists in students table
    await sequelize.query(`
      INSERT INTO students (roll_number, register_number, name, email, department, batch, year_of_study)
      VALUES ('24CS422', '312324104001', 'SANTHOSH L', 'santhosh@example.com', 'CSE', '2024-2028', 1)
      ON CONFLICT (roll_number) DO UPDATE SET name = 'SANTHOSH L', department = 'CSE', batch = '2024-2028';
    `);

    // Ensure sample student profile exists
    await sequelize.query(`
      INSERT INTO profiles (roll_number, name, department, batch)
      VALUES ('24CS422', 'SANTHOSH L', 'CSE', '2024-2028')
      ON CONFLICT (roll_number) DO UPDATE SET name = 'SANTHOSH L', department = 'CSE', batch = '2024-2028';
    `);

    // Ensure sample scores exist
    await sequelize.query(`
      DELETE FROM scores WHERE roll_number = '24CS422';
      INSERT INTO scores (roll_number, parameter_id, marks, semester, provisional, calculated_at)
      VALUES 
        ('24CS422', 'coding_problems', 15, 1, false, NOW()),
        ('24CS422', 'monthly_coding', 15, 1, false, NOW()),
        ('24CS422', 'gate', 10, 1, false, NOW()),
        ('24CS422', 'opensource', 10, 1, false, NOW()),
        ('24CS422', 'competition', 10, 1, false, NOW()),
        ('24CS422', 'internship', 10, 1, false, NOW()),
        ('24CS422', 'project', 15, 1, false, NOW()),
        ('24CS422', 'language', 7, 1, false, NOW()),
        ('24CS422', 'hundred_days', 10, 1, false, NOW()),
        ('24CS422', 'aptitude', 10, 1, false, NOW()),
        ('24CS422', 'certificate', 8, 1, false, NOW()),
        ('24CS422', 'cp_rating', 5, 1, false, NOW());
    `);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Authentication & Security', () => {
    it('should reject request without x-api-key header (401)', async () => {
      const res = await request(app).get('/api/v1/external/students/results');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject request with invalid API key (403)', async () => {
      const res = await request(app)
        .get('/api/v1/external/students/results')
        .set('x-api-key', 'wrong_invalid_key_123');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('GET /api/v1/external/students/:rollNumber/results', () => {
    it('should return 404 for non-existent student', async () => {
      const res = await request(app)
        .get('/api/v1/external/students/NON_EXISTENT_999/results')
        .set('x-api-key', testApiKey);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return clean, non-overexposed results for valid student', async () => {
      const res = await request(app)
        .get(`/api/v1/external/students/${testStudentRoll}/results`)
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.roll_number).toBe('24CS422');
      expect(data.name).toBe('SANTHOSH L');
      expect(data.department).toBe('CSE');
      expect(data.batch).toBe('2024-2028');
      expect(typeof data.total_marks).toBe('number');
      expect(data.max_possible_marks).toBe(250);

      // Verify canonical Level enum
      const validLevels = ['NOT_ELIGIBLE', 'L1', 'L2', 'L3', 'Elite'];
      expect(validLevels).toContain(data.level);
      expect(typeof data.level_condition_met).toBe('boolean');

      // Verify exactly 12 parameter marks
      expect(Array.isArray(data.parameter_marks)).toBe(true);
      expect(data.parameter_marks.length).toBe(12);

      data.parameter_marks.forEach((param) => {
        expect(param).toHaveProperty('parameter_id');
        expect(param).toHaveProperty('name');
        expect(param).toHaveProperty('marks_obtained');
        expect(param).toHaveProperty('max_marks');
        expect(typeof param.marks_obtained).toBe('number');
      });

      // Confirm security: No proof URLs, no mentor personal details exposed
      expect(data).not.toHaveProperty('proof_url');
      expect(data).not.toHaveProperty('certificate_url');
      expect(data).not.toHaveProperty('evidence_urls');
      expect(data).not.toHaveProperty('mentor');
    });
  });

  describe('GET /api/v1/external/students/results (Bulk)', () => {
    it('should return paginated list of student results', async () => {
      const res = await request(app)
        .get('/api/v1/external/students/results?page=1&limit=10')
        .set('x-api-key', testApiKey);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page', 1);
      expect(res.body.data).toHaveProperty('limit', 10);
      expect(Array.isArray(res.body.data.students)).toBe(true);
    });
  });

  describe('POST /api/v1/external/students/batch-lookup', () => {
    it('should return results for requested roll numbers array', async () => {
      const res = await request(app)
        .post('/api/v1/external/students/batch-lookup')
        .set('x-api-key', testApiKey)
        .send({ roll_numbers: [testStudentRoll] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total_requested).toBe(1);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].roll_number).toBe('24CS422');
    });
  });

  describe('Audit Logging Verification', () => {
    it('should have logged API calls in external_api_logs table', async () => {
      // Give async logger a moment
      await new Promise((r) => setTimeout(r, 600));

      const logs = await sequelize.query(
        `SELECT key_id, client_name, endpoint, response_status 
         FROM external_api_logs 
         WHERE endpoint LIKE '/api/v1/external%' 
         ORDER BY called_at DESC 
         LIMIT 5`,
        { type: sequelize.QueryTypes.SELECT }
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].response_status).toBeDefined();
    });
  });
});
