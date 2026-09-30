const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../index');
const sequelize = require('../../config/database');
const AnomalyDetectionService = require('../../services/anomalyDetectionService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || 'user_1',
      roll_number: user.roll_number,
      role: user.role || 'student',
      department: user.department || 'CSE'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Anomaly & Duplicate Detection Service', () => {
  const studentA = { roll_number: 'TEST_ANOMALY_STUDENT_A', role: 'student', department: 'CSE' };
  const studentB = { roll_number: 'TEST_ANOMALY_STUDENT_B', role: 'student', department: 'CSE' };
  const mentorUser = { roll_number: 'MENTOR_CSE_ANOMALY', role: 'mentor', department: 'CSE' };
  const adminUser = { roll_number: 'ADMIN_ANOMALY', role: 'admin', department: 'ADMIN' };

  const tokenA = generateToken(studentA);
  const tokenB = generateToken(studentB);
  const tokenMentor = generateToken(mentorUser);
  const tokenAdmin = generateToken(adminUser);

  beforeAll(async () => {
    await AnomalyDetectionService.initTable();

    // Ensure profiles and students exist
    await sequelize.query(`
      INSERT INTO profiles (id_number, register_number, name, email, department, role)
      VALUES 
        ('TEST_ANOMALY_STUDENT_A', 'REG_ANOM_A', 'Anomaly Student A', 'studenta_test@test.edu', 'CSE', 'student'),
        ('TEST_ANOMALY_STUDENT_B', 'REG_ANOM_B', 'Anomaly Student B', 'studentb_test@test.edu', 'CSE', 'student'),
        ('MENTOR_CSE_ANOMALY', 'REG_MENTOR', 'CSE Mentor', 'mentor_cse@test.edu', 'CSE', 'mentor'),
        ('ADMIN_ANOMALY', 'REG_ADMIN', 'Admin User', 'admin@test.edu', 'ADMIN', 'admin')
      ON CONFLICT (id_number) DO NOTHING;

      INSERT INTO students (roll_number, name, email, department)
      VALUES
        ('TEST_ANOMALY_STUDENT_A', 'Anomaly Student A', 'studenta_test@test.edu', 'CSE'),
        ('TEST_ANOMALY_STUDENT_B', 'Anomaly Student B', 'studentb_test@test.edu', 'CSE')
      ON CONFLICT (roll_number) DO NOTHING;
    `);

    // Clean up test data
    await sequelize.query(`
      DELETE FROM certificate_evidence WHERE student_id IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
      DELETE FROM project_evidence WHERE student_id IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
      DELETE FROM evidence_anomalies WHERE student_id IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
    `);
  });

  afterAll(async () => {
    await sequelize.query(`
      DELETE FROM certificate_evidence WHERE student_id IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
      DELETE FROM project_evidence WHERE student_id IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
      DELETE FROM evidence_anomalies WHERE student_id IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
      DELETE FROM students WHERE roll_number IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B');
      DELETE FROM profiles WHERE id_number IN ('TEST_ANOMALY_STUDENT_A', 'TEST_ANOMALY_STUDENT_B', 'MENTOR_CSE_ANOMALY', 'ADMIN_ANOMALY');
    `);
    await sequelize.close();
  });

  describe('1. Pre-Submission Check API (POST /api/anomaly/check)', () => {
    it('should return allowed: true for unique, clean payload', async () => {
      const res = await request(app)
        .post('/api/anomaly/check')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          module: 'certificate',
          payload: {
            credential_id: 'UNIQUE-CERT-999888',
            verify_url: 'https://cert.org/verify/unique999888',
            credential_name: 'Unique Kubernetes Admin'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.allowed).toBe(true);
      expect(res.body.has_anomaly).toBe(false);
    });
  });

  describe('2. Cross-Student Certificate Duplicate Detection', () => {
    it('should allow Student A to submit a unique certificate', async () => {
      const res = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          credential_name: 'AWS Solutions Architect Associate',
          credential_category: 'INDUSTRY',
          tier_level: 'ASSOCIATE',
          issuing_organization: 'Amazon Web Services',
          credential_id: 'AWS-SAA-UNIQUE-777',
          verify_url: 'https://aws.amazon.com/verify/AWS-SAA-UNIQUE-777'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should REJECT Student B submitting the exact same certificate ID (Cross-Student Duplicate)', async () => {
      const res = await request(app)
        .post('/api/certificate/submit')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          credential_name: 'AWS Solutions Architect Copy',
          credential_category: 'INDUSTRY',
          tier_level: 'ASSOCIATE',
          issuing_organization: 'Amazon Web Services',
          credential_id: 'AWS-SAA-UNIQUE-777', // ← SAME CREDENTIAL ID
          verify_url: 'https://aws.amazon.com/verify/AWS-SAA-UNIQUE-777'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Integrity violation');
      expect(res.body.anomalies[0].type).toBe('DUPLICATE_CROSS_STUDENT');
      expect(res.body.anomalies[0].conflicting_student_id).toBe('TEST_ANOMALY_STUDENT_A');
    });
  });

  describe('3. Cross-Student Project Repo & Proof Duplicate Detection', () => {
    it('should allow Student A to submit unique project repo', async () => {
      const res = await request(app)
        .post('/api/project-pub-patent/submit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          semester: 4,
          achievement_type: 'PROJECT',
          output_name: 'Distributed Cloud Storage Engine',
          achievement_stage: 'WORKING_PROTOTYPE',
          stage_marks: 10,
          proof_url: 'https://github.com/test-org/distributed-cloud-engine'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should REJECT Student B submitting the same repo/proof URL (Cross-Student Repo Duplicate)', async () => {
      const res = await request(app)
        .post('/api/project-pub-patent/submit')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          semester: 4,
          achievement_type: 'PROJECT',
          output_name: 'Copied Cloud Engine',
          achievement_stage: 'WORKING_PROTOTYPE',
          stage_marks: 10,
          proof_url: 'https://github.com/test-org/distributed-cloud-engine' // ← SAME PROOF URL
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Integrity violation');
      expect(res.body.anomalies[0].type).toBe('DUPLICATE_CROSS_STUDENT');
      expect(res.body.anomalies[0].conflicting_student_id).toBe('TEST_ANOMALY_STUDENT_A');
    });
  });

  describe('4. Cross-Semester Reuse Detection', () => {
    it('should flag cross-semester reuse when same student re-submits identical project in another semester', async () => {
      const res = await request(app)
        .post('/api/anomaly/check')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          module: 'project',
          semester: 5, // Previous was semester 4
          payload: {
            output_name: 'Distributed Cloud Storage Engine',
            proof_url: 'https://github.com/test-org/distributed-cloud-engine'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.has_anomaly).toBe(true);
      const reuseAnomaly = res.body.anomalies.find(a => a.type === 'CROSS_SEMESTER_REUSE');
      expect(reuseAnomaly).toBeDefined();
      expect(reuseAnomaly.conflicting_semester).toBe(4);
    });
  });

  describe('5. Mentor Anomaly Flags & Resolution Workflow', () => {
    it('should list flagged anomalies for mentor / admin', async () => {
      const res = await request(app)
        .get('/api/anomaly/flags')
        .set('Authorization', `Bearer ${tokenMentor}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
      expect(res.body.anomalies.length).toBeGreaterThan(0);
    });

    it('should allow mentor/admin to resolve an anomaly flag with notes', async () => {
      const flagsRes = await request(app)
        .get('/api/anomaly/flags')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const firstFlag = flagsRes.body.anomalies[0];
      expect(firstFlag).toBeDefined();

      const resolveRes = await request(app)
        .post(`/api/anomaly/resolve/${firstFlag.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          status: 'CONFIRMED_FRAUD',
          notes: 'Verified plagiarism of certificate credential across students.'
        });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.success).toBe(true);
      expect(resolveRes.body.anomaly.status).toBe('CONFIRMED_FRAUD');
      expect(resolveRes.body.anomaly.resolution_notes).toContain('Verified plagiarism');
    });

    it('should return student integrity audit report', async () => {
      const res = await request(app)
        .get('/api/anomaly/student/TEST_ANOMALY_STUDENT_B')
        .set('Authorization', `Bearer ${tokenMentor}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.student_id).toBe('TEST_ANOMALY_STUDENT_B');
      expect(res.body.is_clean).toBe(false); // Has duplicate flag
    });
  });

  describe('6. Project-Wide Integrity Scanner (POST /api/anomaly/scan-all)', () => {
    it('should run database-wide scan across all evidence tables and return findings', async () => {
      const res = await request(app)
        .post('/api/anomaly/scan-all')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total_anomalies_detected).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.findings)).toBe(true);
    });
  });
});
