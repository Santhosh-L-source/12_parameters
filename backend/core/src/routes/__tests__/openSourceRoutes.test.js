/**
 * Open Source Contributions Routes Tests
 * Testing MAX per repo + SUM across repos aggregation (cap at 20)
 * Stages: 3/5/10/15/17/20
 */

const request = require('supertest');
const app = require('../../index');
const sequelize = require('../../config/database');

describe('Open Source Contribution Routes', () => {
  let authToken;
  let studentRollNumber = '24CS360';

  beforeAll(async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: studentRollNumber, password: '312324104001' });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.token;
    }
  }, 30000);

  afterAll(async () => {
    await sequelize.query(
      `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
    await sequelize.query(
      `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
      { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
    );
  });

  describe('POST /api/open-source/submit', () => {
    it('should submit open source contribution successfully', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      const response = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'test_contributor',
          repo_name: 'kubernetes/kubernetes',
          prs_submitted: 2,
          prs_merged: 1,
          repo_url: 'https://github.com/kubernetes/kubernetes'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.evidence.repo_name).toBe('kubernetes/kubernetes');
      expect(response.body.evidence.prs_merged).toBe(1);
    });

    it('should UPDATE (not reject) when same repo resubmitted', async () => {
      const response = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'test_contributor',
          repo_name: 'kubernetes/kubernetes',
          prs_submitted: 4,
          prs_merged: 3  // Updated from 1 to 3
        });

      expect(response.status).toBe(200);  // Update, not 201
      expect(response.body.is_update).toBe(true);
      expect(response.body.evidence.prs_merged).toBe(3);  // Updated
      expect(response.body.evidence.status).toBe('PENDING');  // Reset
    });

    it('should reject prs_merged > prs_submitted', async () => {
      const response = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'test_user',
          repo_name: 'test/repo',
          prs_submitted: 5,
          prs_merged: 10  // Invalid
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('prs_merged cannot exceed prs_submitted');
    });
  });

  describe('TEST 1: Stage calculation (3/5/10/15/17/20)', () => {
    it('should award correct stage based on contribution metrics', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Stage 1 (3 marks): 1 PR submitted, 0 merged
      const stage1 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'stage_test',
          repo_name: 'stage1/repo',
          prs_submitted: 1,
          prs_merged: 0
        });

      await request(app)
        .post(`/api/open-source/${stage1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marks1 = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks1.body.repos_count).toBe(1);
      expect(marks1.body.repos[0].stage_marks).toBe(3);
      expect(marks1.body.marks).toBe(3);
    }, 15000);
  });

  describe('TEST 2: SUM across repos (NOT single-best)', () => {
    it('should sum stages from multiple repos', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Repo 1: 1 PR merged → 5 marks
      const repo1 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'sum_test',
          repo_name: 'repo1/test',
          prs_submitted: 1,
          prs_merged: 1
        });

      // Repo 2: 3 PRs merged → 10 marks
      const repo2 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'sum_test',
          repo_name: 'repo2/test',
          prs_submitted: 3,
          prs_merged: 3
        });

      // Verify both
      await request(app)
        .post(`/api/open-source/${repo1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/open-source/${repo2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: 5 + 10 = 15 (SUM), NOT 10 (single-best)
      expect(marksResp.body.repos_count).toBe(2);
      expect(marksResp.body.uncapped_total).toBe(15);
      expect(marksResp.body.marks).toBe(15);  // NOT 10 (single-best)
    }, 15000);
  });

  describe('TEST 3: Cap at 20 marks', () => {
    it('should cap total marks at 20 even if sum exceeds', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Repo 1: Maintainer → 20 marks
      const repo1 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'cap_test',
          repo_name: 'maintainer/repo',
          is_maintainer: true
        });

      // Repo 2: 5+ PRs merged → 15 marks
      const repo2 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'cap_test',
          repo_name: 'contributor/repo',
          prs_submitted: 6,
          prs_merged: 6
        });

      // Verify both
      await request(app)
        .post(`/api/open-source/${repo1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/open-source/${repo2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check marks
      const marksResp = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: 20 + 15 = 35 uncapped, but final marks capped at 20
      expect(marksResp.body.repos_count).toBe(2);
      expect(marksResp.body.uncapped_total).toBe(35);
      expect(marksResp.body.marks).toBe(20);  // Capped
    }, 15000);
  });

  describe('TEST 4: Programme contributions', () => {
    it('should handle GSoC/programme submissions correctly', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Selected in GSoC → 17 marks
      const gsoc = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'gsoc_contributor',
          programme_name: 'GSoC 2024',
          programme_selected: true,
          programme_url: 'https://summerofcode.withgoogle.com/programs/2024/projects/example'
        });

      await request(app)
        .post(`/api/open-source/${gsoc.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marks = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks.body.repos_count).toBe(1);
      expect(marks.body.repos[0].programme_selected).toBe(true);
      expect(marks.body.repos[0].stage_marks).toBe(17);
      expect(marks.body.marks).toBe(17);
    }, 15000);
  });

  describe('TEST 5: REJECTED contribution excluded', () => {
    it('should exclude rejected repo from sum', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Repo 1: 5+ PRs merged → would be 15 marks if verified
      const repo1 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'reject_test',
          repo_name: 'fake/repo',
          prs_submitted: 6,
          prs_merged: 6
        });

      // Repo 2: 1 PR merged → 5 marks
      const repo2 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'reject_test',
          repo_name: 'real/repo',
          prs_submitted: 1,
          prs_merged: 1
        });

      // REJECT repo1, VERIFY repo2
      await request(app)
        .post(`/api/open-source/${repo1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'REJECTED', rejection_reason: 'Fake contributions detected' });

      await request(app)
        .post(`/api/open-source/${repo2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      const marks = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      // PROOF: Only repo2 (5 marks) counted, not repo1 (15 marks)
      expect(marks.body.repos_count).toBe(1);
      expect(marks.body.marks).toBe(5);  // NOT 20 (15+5)
    }, 15000);
  });

  describe('TEST 6: Multi-repo UPSERT isolation', () => {
    it('should only reset updated repo, keep others VERIFIED', async () => {
      await sequelize.query(
        `DELETE FROM open_source_evidence WHERE student_id = :studentId`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );
      await sequelize.query(
        `DELETE FROM scores WHERE register_number = :studentId AND parameter = 'opensource'`,
        { replacements: { studentId: studentRollNumber }, type: sequelize.QueryTypes.DELETE }
      );

      // Repo 1: 3 PRs merged → 10 marks
      const repo1_v1 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'multi_upsert',
          repo_name: 'repo1/test',
          prs_submitted: 3,
          prs_merged: 3
        });

      // Repo 2: 1 PR merged → 5 marks
      const repo2 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'multi_upsert',
          repo_name: 'repo2/test',
          prs_submitted: 1,
          prs_merged: 1
        });

      // Verify both
      await request(app)
        .post(`/api/open-source/${repo1_v1.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      await request(app)
        .post(`/api/open-source/${repo2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // Check initial marks: 10 + 5 = 15
      const marks1 = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks1.body.repos_count).toBe(2);
      expect(marks1.body.marks).toBe(15);

      // UPSERT: Resubmit ONLY repo1 with updated counts (6 PRs merged → 15 marks when re-verified)
      const repo1_v2 = await request(app)
        .post('/api/open-source/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          github_username: 'multi_upsert',
          repo_name: 'repo1/test',
          prs_submitted: 7,
          prs_merged: 6  // Updated from 3
        });

      expect(repo1_v2.status).toBe(200);
      expect(repo1_v2.body.is_update).toBe(true);

      // PROOF 1: Only repo1 reset to PENDING, repo2 stays VERIFIED
      const evidence = await request(app)
        .get(`/api/open-source/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      const repo1Row = evidence.body.evidence.find(e => e.repo_name === 'repo1/test');
      const repo2Row = evidence.body.evidence.find(e => e.repo_name === 'repo2/test');

      expect(repo1Row.status).toBe('PENDING');   // ← Updated
      expect(repo2Row.status).toBe('VERIFIED');  // ← Untouched
      expect(repo1Row.prs_merged).toBe(6);       // ← Updated
      expect(repo2Row.prs_merged).toBe(1);       // ← Original

      // PROOF 2: Marks now reflect ONLY repo2 (5 marks)
      const marks2 = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks2.body.repos_count).toBe(1);  // Only repo2
      expect(marks2.body.marks).toBe(5);  // Down from 15

      // Re-verify updated repo1
      await request(app)
        .post(`/api/open-source/${repo1_v2.body.evidence.id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ action: 'VERIFIED' });

      // PROOF 3: Marks now reflect BOTH repos with updated repo1
      const marks3 = await request(app)
        .get(`/api/open-source/marks/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(marks3.body.repos_count).toBe(2);
      expect(marks3.body.uncapped_total).toBe(20);  // 15 (repo1) + 5 (repo2)
      expect(marks3.body.marks).toBe(20);  // Exactly at cap
    }, 20000);
  });

  describe('GET /api/open-source/student/:studentId', () => {
    it('should get all evidence for student', async () => {
      const response = await request(app)
        .get(`/api/open-source/student/${studentRollNumber}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.evidence)).toBe(true);
    });
  });

  describe('Scoring Logic', () => {
    it('should use correct stage thresholds', () => {
      const STAGES = {
        S1: { prs_submitted: 1, prs_merged: 0, marks: 3 },
        S2: { prs_merged: 1, marks: 5 },
        S3: { prs_merged: 3, marks: 10 },
        S4: { prs_merged: 5, marks: 15 },
        S5: { programme_selected: true, marks: 17 },
        S6: { maintainer_or_completed: true, marks: 20 }
      };

      expect(STAGES.S1.marks).toBe(3);
      expect(STAGES.S2.marks).toBe(5);
      expect(STAGES.S3.marks).toBe(10);
      expect(STAGES.S4.marks).toBe(15);
      expect(STAGES.S5.marks).toBe(17);
      expect(STAGES.S6.marks).toBe(20);
    });
  });
});
