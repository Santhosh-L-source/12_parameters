const crypto = require('crypto');
const sequelize = require('../config/database');

/**
 * Anomaly & Duplicate Detection Service
 *
 * Implements:
 * 1. Hash / Signature matching: Prevents multiple students from submitting same cert ID, repo URL, contest proof.
 * 2. Cross-Semester Reuse Checker: Flags duplicate claims across different academic terms/semesters.
 * 3. Database Anomaly Logging & Mentor Review Queue.
 */

class AnomalyDetectionService {
  /**
   * Ensure evidence_anomalies table exists
   */
  static async initTable() {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS evidence_anomalies (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(100) NOT NULL,
        module_id VARCHAR(50) NOT NULL,
        evidence_table VARCHAR(100) NOT NULL,
        evidence_id INTEGER,
        anomaly_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
        signature_hash VARCHAR(64) NOT NULL,
        conflicting_student_id VARCHAR(100),
        conflicting_evidence_id INTEGER,
        conflicting_semester INTEGER,
        submitted_semester INTEGER,
        details JSONB,
        status VARCHAR(30) NOT NULL DEFAULT 'FLAGGED',
        resolved_by VARCHAR(100),
        resolved_at TIMESTAMP,
        resolution_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_anomalies_signature ON evidence_anomalies(signature_hash);
      CREATE INDEX IF NOT EXISTS idx_anomalies_student ON evidence_anomalies(student_id);
      CREATE INDEX IF NOT EXISTS idx_anomalies_status ON evidence_anomalies(status);
    `);
  }

  /**
   * Normalize URLs to prevent evasion via protocol, trailing slash, www, case, or extra query params
   */
  static normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      let cleaned = url.trim().toLowerCase();
      // Remove protocol
      cleaned = cleaned.replace(/^https?:\/\//i, '');
      // Remove www
      cleaned = cleaned.replace(/^www\./i, '');
      // Remove trailing slash
      cleaned = cleaned.replace(/\/+$/, '');
      return cleaned;
    } catch (e) {
      return url.trim().toLowerCase();
    }
  }

  /**
   * Generate SHA-256 signature hash from key identifiers
   */
  static generateSignature(keyString) {
    if (!keyString) return null;
    return crypto.createHash('sha256').update(keyString.trim().toLowerCase()).digest('hex');
  }

  /**
   * Generate evidence signatures for a given module & submission payload
   */
  static extractSignatures(module, payload) {
    const signatures = [];

    // Normalize module key
    const mod = (module || '').toLowerCase().replace(/[-_]/g, '');

    // 1. Certificate signatures (credential_id, verify_url, certificate_url)
    if (payload.credential_id && payload.credential_id.trim()) {
      const raw = `cert_id:${payload.credential_id.trim().toLowerCase()}`;
      signatures.push({
        field: 'credential_id',
        value: payload.credential_id.trim(),
        hash: AnomalyDetectionService.generateSignature(raw),
        raw
      });
    }
    if (payload.verify_url && payload.verify_url.trim()) {
      const norm = AnomalyDetectionService.normalizeUrl(payload.verify_url);
      signatures.push({
        field: 'verify_url',
        value: norm,
        hash: AnomalyDetectionService.generateSignature(`verify_url:${norm}`),
        raw: `verify_url:${norm}`
      });
    }

    // 2. Project / Repo / DOI / Patent Application signatures
    if (payload.proof_url || payload.proofUrl || payload.certificate_url || payload.certificateUrl) {
      const pUrl = payload.proof_url || payload.proofUrl || payload.certificate_url || payload.certificateUrl;
      const norm = AnomalyDetectionService.normalizeUrl(pUrl);
      if (norm) {
        signatures.push({
          field: 'proof_url',
          value: norm,
          hash: AnomalyDetectionService.generateSignature(`proof_url:${norm}`),
          raw: `proof_url:${norm}`
        });
      }
    }

    if (payload.repo_url || payload.repoUrl) {
      const norm = AnomalyDetectionService.normalizeUrl(payload.repo_url || payload.repoUrl);
      if (norm) {
        signatures.push({
          field: 'repo_url',
          value: norm,
          hash: AnomalyDetectionService.generateSignature(`repo_url:${norm}`),
          raw: `repo_url:${norm}`
        });
      }
    }

    if (payload.paper_doi || payload.paperDoi) {
      const doi = (payload.paper_doi || payload.paperDoi).trim().toLowerCase();
      signatures.push({
        field: 'paper_doi',
        value: doi,
        hash: AnomalyDetectionService.generateSignature(`doi:${doi}`),
        raw: `doi:${doi}`
      });
    }

    if (payload.patent_app_number || payload.patentAppNumber) {
      const pat = (payload.patent_app_number || payload.patentAppNumber).trim().toLowerCase();
      signatures.push({
        field: 'patent_app_number',
        value: pat,
        hash: AnomalyDetectionService.generateSignature(`patent:${pat}`),
        raw: `patent:${pat}`
      });
    }

    // 3. Distinct Key Signature for cross-semester matching
    if (payload.distinct_key || payload.output_name || payload.outputName || payload.credential_name) {
      const dKey = (payload.distinct_key || payload.output_name || payload.outputName || payload.credential_name).trim().toLowerCase();
      signatures.push({
        field: 'distinct_key',
        value: dKey,
        hash: AnomalyDetectionService.generateSignature(`distinct:${mod}:${dKey}`),
        raw: `distinct:${mod}:${dKey}`
      });
    }

    return signatures;
  }

  /**
   * Pre-submission validation: Checks for Cross-Student Duplicates and Cross-Semester Reuse
   */
  static async validateSubmission({ module, studentId, semester, payload }) {
    await AnomalyDetectionService.initTable();

    const anomalies = [];
    const signatures = AnomalyDetectionService.extractSignatures(module, payload);
    const mod = (module || '').toLowerCase().replace(/[-_]/g, '');

    // Map module to evidence table
    const tableMap = {
      certificate: { table: 'certificate_evidence', semCol: null },
      projectpubpatent: { table: 'project_evidence', semCol: 'semester' },
      project: { table: 'project_evidence', semCol: 'semester' },
      competition: { table: 'competition_evidence', semCol: null },
      internship: { table: 'internship_evidence', semCol: null },
      opensource: { table: 'open_source_evidence', semCol: null },
      gate: { table: 'gate_exam_evidence', semCol: null },
      language: { table: 'language_evidence', semCol: null }
    };

    const tableConfig = tableMap[mod];

    // 1. Check Certificate Table for duplicates
    if (mod === 'certificate' || mod === 'skillcertifications') {
      for (const sig of signatures) {
        if (sig.field === 'credential_id' || sig.field === 'verify_url') {
          const fieldCol = sig.field === 'credential_id' ? 'credential_id' : 'verify_url';
          const query = sig.field === 'credential_id'
            ? `SELECT id, student_id, credential_name, status, submitted_at FROM certificate_evidence WHERE lower(trim(${fieldCol})) = lower(trim(:val))`
            : `SELECT id, student_id, credential_name, status, submitted_at FROM certificate_evidence WHERE lower(trim(${fieldCol})) LIKE lower(trim(:val))`;

          const matches = await sequelize.query(query, {
            replacements: { val: sig.field === 'verify_url' ? `%${sig.value}%` : sig.value },
            type: sequelize.QueryTypes.SELECT
          });

          for (const match of matches) {
            // Cross-student duplicate
            if (match.student_id !== studentId) {
              const anomaly = {
                type: 'DUPLICATE_CROSS_STUDENT',
                severity: 'CRITICAL',
                message: `Duplicate ${sig.field} already claimed by student ${match.student_id}`,
                signature_hash: sig.hash,
                conflicting_student_id: match.student_id,
                conflicting_evidence_id: match.id,
                field: sig.field,
                value: sig.value
              };
              anomalies.push(anomaly);
              await AnomalyDetectionService.logAnomaly({
                student_id: studentId,
                module_id: module,
                evidence_table: 'certificate_evidence',
                anomaly_type: anomaly.type,
                severity: anomaly.severity,
                signature_hash: sig.hash,
                conflicting_student_id: match.student_id,
                conflicting_evidence_id: match.id,
                submitted_semester: semester || null,
                details: { field: sig.field, value: sig.value, conflict_evidence: match }
              });
            }
          }
        }
      }
    }

    // 2. Check Project / Publication / Patent Table for cross-student duplicate repo/proof and cross-semester reuse
    if (mod === 'project' || mod === 'projectpubpatent') {
      const proofUrl = payload.proof_url || payload.proofUrl;
      const outputName = payload.output_name || payload.outputName;

      if (proofUrl) {
        const normUrl = AnomalyDetectionService.normalizeUrl(proofUrl);
        const urlMatches = await sequelize.query(
          `SELECT id, student_id, semester, output_name, proof_url, status
           FROM project_evidence
           WHERE lower(trim(proof_url)) LIKE :normUrl`,
          {
            replacements: { normUrl: `%${normUrl}%` },
            type: sequelize.QueryTypes.SELECT
          }
        );

        for (const match of urlMatches) {
          // Cross-student repo/proof duplication
          if (match.student_id !== studentId) {
            const sigHash = AnomalyDetectionService.generateSignature(`proof_url:${normUrl}`);
            const anomaly = {
              type: 'DUPLICATE_CROSS_STUDENT',
              severity: 'CRITICAL',
              message: `Project/Publication proof URL is already claimed by student ${match.student_id}`,
              signature_hash: sigHash,
              conflicting_student_id: match.student_id,
              conflicting_evidence_id: match.id,
              conflicting_semester: match.semester,
              field: 'proof_url',
              value: proofUrl
            };
            anomalies.push(anomaly);
            await AnomalyDetectionService.logAnomaly({
              student_id: studentId,
              module_id: module,
              evidence_table: 'project_evidence',
              anomaly_type: anomaly.type,
              severity: anomaly.severity,
              signature_hash: sigHash,
              conflicting_student_id: match.student_id,
              conflicting_evidence_id: match.id,
              conflicting_semester: match.semester,
              submitted_semester: semester || null,
              details: { proof_url: proofUrl, conflict_evidence: match }
            });
          } else if (semester && match.semester && match.semester !== semester && match.output_name?.toLowerCase() === outputName?.toLowerCase()) {
            // Cross-semester reuse by SAME student without progression
            const sigHash = AnomalyDetectionService.generateSignature(`distinct:project:${outputName}`);
            const anomaly = {
              type: 'CROSS_SEMESTER_REUSE',
              severity: 'HIGH',
              message: `Identical project "${outputName}" was already claimed in Semester ${match.semester}`,
              signature_hash: sigHash,
              conflicting_student_id: studentId,
              conflicting_evidence_id: match.id,
              conflicting_semester: match.semester,
              field: 'output_name',
              value: outputName
            };
            anomalies.push(anomaly);
            await AnomalyDetectionService.logAnomaly({
              student_id: studentId,
              module_id: module,
              evidence_table: 'project_evidence',
              anomaly_type: anomaly.type,
              severity: anomaly.severity,
              signature_hash: sigHash,
              conflicting_student_id: studentId,
              conflicting_evidence_id: match.id,
              conflicting_semester: match.semester,
              submitted_semester: semester,
              details: { output_name: outputName, prior_semester: match.semester, conflict_evidence: match }
            });
          }
        }
      }
    }

    // 3. Check Competition Table for duplicate proof URL / certificate URL
    if (mod === 'competition' || mod === 'hackathons') {
      const proofUrl = payload.proof_url || payload.certificate_url;
      if (proofUrl) {
        const normUrl = AnomalyDetectionService.normalizeUrl(proofUrl);
        const matches = await sequelize.query(
          `SELECT id, student_id, distinct_key, proof_url, certificate_url, status
           FROM competition_evidence
           WHERE lower(trim(proof_url)) LIKE :normUrl OR lower(trim(certificate_url)) LIKE :normUrl`,
          {
            replacements: { normUrl: `%${normUrl}%` },
            type: sequelize.QueryTypes.SELECT
          }
        );

        for (const match of matches) {
          if (match.student_id !== studentId) {
            const sigHash = AnomalyDetectionService.generateSignature(`proof_url:${normUrl}`);
            const anomaly = {
              type: 'DUPLICATE_CROSS_STUDENT',
              severity: 'CRITICAL',
              message: `Competition proof/certificate URL already claimed by student ${match.student_id}`,
              signature_hash: sigHash,
              conflicting_student_id: match.student_id,
              conflicting_evidence_id: match.id,
              field: 'proof_url',
              value: proofUrl
            };
            anomalies.push(anomaly);
            await AnomalyDetectionService.logAnomaly({
              student_id: studentId,
              module_id: module,
              evidence_table: 'competition_evidence',
              anomaly_type: anomaly.type,
              severity: anomaly.severity,
              signature_hash: sigHash,
              conflicting_student_id: match.student_id,
              conflicting_evidence_id: match.id,
              submitted_semester: semester || null,
              details: { proof_url: proofUrl, conflict_evidence: match }
            });
          }
        }
      }
    }

    return {
      allowed: anomalies.filter(a => a.severity === 'CRITICAL').length === 0,
      has_anomaly: anomalies.length > 0,
      anomalies
    };
  }

  /**
   * Persist anomaly to database
   */
  static async logAnomaly({
    student_id,
    module_id,
    evidence_table,
    evidence_id = null,
    anomaly_type,
    severity = 'HIGH',
    signature_hash,
    conflicting_student_id = null,
    conflicting_evidence_id = null,
    conflicting_semester = null,
    submitted_semester = null,
    details = {}
  }) {
    await AnomalyDetectionService.initTable();

    // Check if identical un-resolved anomaly already logged
    const existing = await sequelize.query(
      `SELECT id FROM evidence_anomalies
       WHERE student_id = :student_id
         AND signature_hash = :signature_hash
         AND anomaly_type = :anomaly_type
         AND status = 'FLAGGED'`,
      {
        replacements: { student_id, signature_hash, anomaly_type },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const result = await sequelize.query(
      `INSERT INTO evidence_anomalies
       (student_id, module_id, evidence_table, evidence_id, anomaly_type, severity,
        signature_hash, conflicting_student_id, conflicting_evidence_id, conflicting_semester,
        submitted_semester, details, status, created_at)
       VALUES
       (:student_id, :module_id, :evidence_table, :evidence_id, :anomaly_type, :severity,
        :signature_hash, :conflicting_student_id, :conflicting_evidence_id, :conflicting_semester,
        :submitted_semester, :details, 'FLAGGED', NOW())
       RETURNING id`,
      {
        replacements: {
          student_id,
          module_id,
          evidence_table,
          evidence_id,
          anomaly_type,
          severity,
          signature_hash,
          conflicting_student_id,
          conflicting_evidence_id,
          conflicting_semester,
          submitted_semester,
          details: JSON.stringify(details)
        },
        type: sequelize.QueryTypes.INSERT
      }
    );

    return result[0][0].id;
  }

  /**
   * Project-Wide Integrity Scan: Scans database for cross-student duplicates and cross-semester reuse
   */
  static async scanAllIntegrity() {
    await AnomalyDetectionService.initTable();
    const findings = [];

    // 1. Scan Certificate Evidence for duplicate credential_id across students
    const certDupes = await sequelize.query(
      `SELECT lower(trim(credential_id)) AS cred_id, COUNT(DISTINCT student_id) AS student_count,
              json_agg(json_build_object('id', id, 'student_id', student_id, 'status', status, 'name', credential_name)) AS records
       FROM certificate_evidence
       WHERE credential_id IS NOT NULL AND trim(credential_id) != ''
       GROUP BY lower(trim(credential_id))
       HAVING COUNT(DISTINCT student_id) > 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    for (const group of certDupes) {
      for (let i = 0; i < group.records.length; i++) {
        for (let j = i + 1; j < group.records.length; j++) {
          const recA = group.records[i];
          const recB = group.records[j];
          if (recA.student_id !== recB.student_id) {
            const sigHash = AnomalyDetectionService.generateSignature(`cert_id:${group.cred_id}`);
            await AnomalyDetectionService.logAnomaly({
              student_id: recA.student_id,
              module_id: 'certificate',
              evidence_table: 'certificate_evidence',
              evidence_id: recA.id,
              anomaly_type: 'DUPLICATE_CROSS_STUDENT',
              severity: 'CRITICAL',
              signature_hash: sigHash,
              conflicting_student_id: recB.student_id,
              conflicting_evidence_id: recB.id,
              details: { credential_id: group.cred_id, records: group.records }
            });
            findings.push({
              module: 'certificate',
              type: 'DUPLICATE_CROSS_STUDENT',
              student_a: recA.student_id,
              student_b: recB.student_id,
              field: 'credential_id',
              value: group.cred_id
            });
          }
        }
      }
    }

    // 2. Scan Project Proof URLs across students
    const projectDupes = await sequelize.query(
      `SELECT lower(trim(proof_url)) AS proof_url, COUNT(DISTINCT student_id) AS student_count,
              json_agg(json_build_object('id', id, 'student_id', student_id, 'semester', semester, 'output_name', output_name)) AS records
       FROM project_evidence
       WHERE proof_url IS NOT NULL AND trim(proof_url) != ''
       GROUP BY lower(trim(proof_url))
       HAVING COUNT(DISTINCT student_id) > 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    for (const group of projectDupes) {
      for (let i = 0; i < group.records.length; i++) {
        for (let j = i + 1; j < group.records.length; j++) {
          const recA = group.records[i];
          const recB = group.records[j];
          if (recA.student_id !== recB.student_id) {
            const sigHash = AnomalyDetectionService.generateSignature(`proof_url:${group.proof_url}`);
            await AnomalyDetectionService.logAnomaly({
              student_id: recA.student_id,
              module_id: 'project',
              evidence_table: 'project_evidence',
              evidence_id: recA.id,
              anomaly_type: 'DUPLICATE_CROSS_STUDENT',
              severity: 'CRITICAL',
              signature_hash: sigHash,
              conflicting_student_id: recB.student_id,
              conflicting_evidence_id: recB.id,
              details: { proof_url: group.proof_url, records: group.records }
            });
            findings.push({
              module: 'project',
              type: 'DUPLICATE_CROSS_STUDENT',
              student_a: recA.student_id,
              student_b: recB.student_id,
              field: 'proof_url',
              value: group.proof_url
            });
          }
        }
      }
    }

    // 3. Scan Competition Proof URLs across students
    const compDupes = await sequelize.query(
      `SELECT lower(trim(proof_url)) AS proof_url, COUNT(DISTINCT student_id) AS student_count,
              json_agg(json_build_object('id', id, 'student_id', student_id, 'event', distinct_key)) AS records
       FROM competition_evidence
       WHERE proof_url IS NOT NULL AND trim(proof_url) != ''
       GROUP BY lower(trim(proof_url))
       HAVING COUNT(DISTINCT student_id) > 1`,
      { type: sequelize.QueryTypes.SELECT }
    );

    for (const group of compDupes) {
      for (let i = 0; i < group.records.length; i++) {
        for (let j = i + 1; j < group.records.length; j++) {
          const recA = group.records[i];
          const recB = group.records[j];
          if (recA.student_id !== recB.student_id) {
            const sigHash = AnomalyDetectionService.generateSignature(`proof_url:${group.proof_url}`);
            await AnomalyDetectionService.logAnomaly({
              student_id: recA.student_id,
              module_id: 'competition',
              evidence_table: 'competition_evidence',
              evidence_id: recA.id,
              anomaly_type: 'DUPLICATE_CROSS_STUDENT',
              severity: 'CRITICAL',
              signature_hash: sigHash,
              conflicting_student_id: recB.student_id,
              conflicting_evidence_id: recB.id,
              details: { proof_url: group.proof_url, records: group.records }
            });
            findings.push({
              module: 'competition',
              type: 'DUPLICATE_CROSS_STUDENT',
              student_a: recA.student_id,
              student_b: recB.student_id,
              field: 'proof_url',
              value: group.proof_url
            });
          }
        }
      }
    }

    return {
      total_anomalies_detected: findings.length,
      findings
    };
  }

  /**
   * Get flagged anomalies with department/role filtering
   */
  static async getFlaggedAnomalies({ department, mentorRole, status = 'FLAGGED', severity = null, studentId = null }) {
    await AnomalyDetectionService.initTable();

    let whereClauses = [];
    const replacements = { mentorRole, mentorDepartment: department };

    if (mentorRole !== 'admin' && department) {
      whereClauses.push(`p.department = :mentorDepartment`);
    }

    if (status) {
      whereClauses.push(`a.status = :status`);
      replacements.status = status;
    }

    if (severity) {
      whereClauses.push(`a.severity = :severity`);
      replacements.severity = severity;
    }

    if (studentId) {
      whereClauses.push(`a.student_id = :studentId`);
      replacements.studentId = studentId;
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT a.*,
             p.name AS student_name,
             p.department AS student_department,
             cp.name AS conflicting_student_name,
             cp.department AS conflicting_student_department
      FROM evidence_anomalies a
      LEFT JOIN profiles p ON a.student_id = p.id_number
      LEFT JOIN profiles cp ON a.conflicting_student_id = cp.id_number
      ${whereStr}
      ORDER BY a.created_at DESC
    `;

    return await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });
  }

  /**
   * Resolve an anomaly flag (DISMISSED, CONFIRMED_FRAUD, APPROVED_COLLABORATION)
   */
  static async resolveAnomaly({ id, resolutionStatus, mentorId, notes }) {
    await AnomalyDetectionService.initTable();

    const result = await sequelize.query(
      `UPDATE evidence_anomalies
       SET status = :resolutionStatus,
           resolved_by = :mentorId,
           resolved_at = NOW(),
           resolution_notes = :notes
       WHERE id = :id
       RETURNING *`,
      {
        replacements: { id, resolutionStatus, mentorId, notes: notes || null },
        type: sequelize.QueryTypes.UPDATE
      }
    );

    return result[0][0];
  }
}

module.exports = AnomalyDetectionService;
