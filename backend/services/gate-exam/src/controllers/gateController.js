'use strict';

const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');
const { calculateFinalScore } = require('../services/gateScoringService');

// ─── Naming converters ────────────────────────────────────────────────────────
// Supabase columns are snake_case; the API and scoring service use camelCase.

function snakeToCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z\d])/g, (_, c) => c.toUpperCase()),
      v,
    ])
  );
}

function camelToSnake(obj) {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').replace(/([a-z])(\d)/g, '$1_$2').toLowerCase(),
      v,
    ])
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveCalibration(branchCode) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('gate_branch_calibration')
    .select('*')
    .eq('branch_code', branchCode)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? snakeToCamel(data) : null;
}

function notFound(err) {
  // PostgREST: PGRST116 = "The result contains 0 rows"
  return err && err.code === 'PGRST116';
}

// ─── Student endpoints ────────────────────────────────────────────────────────

async function submitEvidence(req, res) {
  try {
    const {
      studentId, semesterId, diagnosticCompleted, testsCompleted,
      fullLengthTestsCompleted, averageScorePercent, officialAppearance,
      qualified, gateScore, branchCode, optionalExamType,
      optionalScorecardValid, centralThresholdMet, proofUrl,
    } = req.body;

    if (!studentId || !semesterId || !branchCode) {
      return res.status(400).json({ error: 'studentId, semesterId, and branchCode are required' });
    }
    if (semesterId < 1 || semesterId > 8) {
      return res.status(400).json({ error: 'semesterId must be between 1 and 8' });
    }

    const { data, error } = await supabase
      .from('gate_evidence')
      .insert(camelToSnake({
        studentId,
        semesterId,
        diagnosticCompleted: !!diagnosticCompleted,
        testsCompleted: testsCompleted || 0,
        fullLengthTestsCompleted: fullLengthTestsCompleted || 0,
        averageScorePercent: averageScorePercent || 0,
        officialAppearance: !!officialAppearance,
        qualified: !!qualified,
        gateScore: gateScore || null,
        branchCode: String(branchCode).toUpperCase(),
        optionalExamType: optionalExamType || null,
        optionalScorecardValid: !!optionalScorecardValid,
        centralThresholdMet: !!centralThresholdMet,
        proofUrl: proofUrl || null,
        status: 'PENDING',
      }))
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ data: snakeToCamel(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function uploadProof(req, res) {
  try {
    const { fileName, fileData, studentId } = req.body;
    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'fileName and fileData are required' });
    }

    const buffer = Buffer.from(fileData, 'base64');
    const ext = fileName.split('.').pop().toLowerCase();
    const safeName = `${studentId || 'unknown'}_${Date.now()}.${ext}`;
    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');

    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    fs.writeFileSync(path.join(uploadsDir, safeName), buffer);

    const protocol = req.protocol;
    const host = req.get('host');
    return res.json({ url: `${protocol}://${host}/uploads/${safeName}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function searchByRegisterNumber(req, res) {
  try {
    const { registerNumber } = req.query;
    if (!registerNumber) {
      return res.status(400).json({ error: 'registerNumber query param is required' });
    }

    const { data, error } = await supabase
      .from('gate_evidence')
      .select('*')
      .eq('student_id', registerNumber)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No evidence found for this register number' });
    }

    // Return the most recent PENDING record first, otherwise the most recent record
    const pending = data.find((r) => r.status === 'PENDING');
    return res.json({ data: snakeToCamel(pending || data[0]), all: data.map(snakeToCamel) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getEvidence(req, res) {
  try {
    const { data, error } = await supabase
      .from('gate_evidence')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (notFound(error)) return res.status(404).json({ error: 'Evidence not found' });
      throw error;
    }
    return res.json({ data: snakeToCamel(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Mentor endpoint ──────────────────────────────────────────────────────────

async function verifyEvidence(req, res) {
  try {
    const { action, mentorId } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: "action must be 'APPROVE' or 'REJECT'" });
    }
    if (!mentorId) {
      return res.status(400).json({ error: 'mentorId is required' });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from('gate_evidence')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchErr) {
      if (notFound(fetchErr)) return res.status(404).json({ error: 'Evidence not found' });
      throw fetchErr;
    }
    if (existing.status !== 'PENDING') {
      return res.status(409).json({ error: `Evidence is already ${existing.status}` });
    }

    if (action === 'REJECT') {
      const { data, error } = await supabase
        .from('gate_evidence')
        .update({ status: 'REJECTED', mentor_id: mentorId, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: snakeToCamel(data) });
    }

    // APPROVE — calculate score
    const evidenceCamel = snakeToCamel(existing);
    const calibration = await getActiveCalibration(evidenceCamel.branchCode);
    const { coreTier, bonus, finalScore, flagMissingCalibration } = calculateFinalScore(
      evidenceCamel,
      calibration
    );

    const { data, error } = await supabase
      .from('gate_evidence')
      .update({
        status: 'APPROVED',
        mentor_id: mentorId,
        verified_at: new Date().toISOString(),
        core_tier: coreTier,
        bonus,
        final_score: finalScore,
        flag_missing_calibration: flagMissingCalibration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({
      data: snakeToCamel(data),
      scoring: { coreTier, bonus, finalScore, flagMissingCalibration },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function verifyByRegisterNumber(req, res) {
  try {
    const { action, mentorId } = req.body;
    const { registerNumber } = req.params;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: "action must be 'APPROVE' or 'REJECT'" });
    }
    if (!mentorId) {
      return res.status(400).json({ error: 'mentorId is required' });
    }

    const { data: rows, error: fetchErr } = await supabase
      .from('gate_evidence')
      .select('*')
      .eq('student_id', registerNumber)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No PENDING evidence found for this register number' });
    }

    const existing = rows[0];

    if (action === 'REJECT') {
      const { data, error } = await supabase
        .from('gate_evidence')
        .update({ status: 'REJECTED', mentor_id: mentorId, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ data: snakeToCamel(data) });
    }

    const evidenceCamel = snakeToCamel(existing);
    const calibration = await getActiveCalibration(evidenceCamel.branchCode);
    const { coreTier, bonus, finalScore, flagMissingCalibration } = calculateFinalScore(evidenceCamel, calibration);

    const { data, error } = await supabase
      .from('gate_evidence')
      .update({
        status: 'APPROVED',
        mentor_id: mentorId,
        verified_at: new Date().toISOString(),
        core_tier: coreTier,
        bonus,
        final_score: finalScore,
        flag_missing_calibration: flagMissingCalibration,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return res.json({
      data: snakeToCamel(data),
      scoring: { coreTier, bonus, finalScore, flagMissingCalibration },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Admin: branch calibration ────────────────────────────────────────────────

async function listCalibrations(req, res) {
  try {
    let query = supabase
      .from('gate_branch_calibration')
      .select('*')
      .order('branch_code')
      .order('effective_from', { ascending: false });

    if (req.query.branchCode) {
      query = query.eq('branch_code', req.query.branchCode.toUpperCase());
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ data: data.map(snakeToCamel) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function createCalibration(req, res) {
  try {
    const { branchCode, minQualifyingScore, minScoreFor25Marks, effectiveFrom, effectiveTo, updatedBy } =
      req.body;

    if (!branchCode || minQualifyingScore == null || minScoreFor25Marks == null || !effectiveFrom || !updatedBy) {
      return res.status(400).json({
        error: 'branchCode, minQualifyingScore, minScoreFor25Marks, effectiveFrom, and updatedBy are required',
      });
    }

    const { data, error } = await supabase
      .from('gate_branch_calibration')
      .insert(camelToSnake({
        branchCode: branchCode.toUpperCase(),
        minQualifyingScore,
        minScoreFor25Marks,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        updatedBy,
      }))
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ data: snakeToCamel(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateCalibration(req, res) {
  try {
    const allowed = ['minQualifyingScore', 'minScoreFor25Marks', 'effectiveFrom', 'effectiveTo', 'updatedBy'];
    const updates = Object.fromEntries(
      allowed.filter((f) => req.body[f] != null).map((f) => [f, req.body[f]])
    );

    if (!updates.updatedBy) {
      return res.status(400).json({ error: 'updatedBy is required' });
    }

    const { data, error } = await supabase
      .from('gate_branch_calibration')
      .update({ ...camelToSnake(updates), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (notFound(error)) return res.status(404).json({ error: 'Calibration entry not found' });
      throw error;
    }
    return res.json({ data: snakeToCamel(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getMarks(req, res) {
  try {
    const studentId = req.params.studentId;

    const { data, error } = await supabase
      .from('gate_evidence')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'APPROVED')
      .order('final_score', { ascending: false })
      .limit(1);

    if (error) {
      return res.json({
        studentId,
        module: 'Gate Exam',
        maxMarks: 25,
        marks: 0,
        evidenceCount: 0,
      });
    }

    const best = data && data.length > 0 ? data[0] : null;
    const marks = best ? (best.final_score || 0) : 0;

    return res.json({
      studentId,
      module: 'Gate Exam',
      maxMarks: 25,
      marks: Math.min(marks, 25),
      evidenceCount: data ? data.length : 0,
    });
  } catch (err) {
    return res.json({
      studentId: req.params.studentId,
      module: 'Gate Exam',
      maxMarks: 25,
      marks: 0,
      evidenceCount: 0,
    });
  }
}

module.exports = {
  uploadProof,
  submitEvidence,
  searchByRegisterNumber,
  getEvidence,
  getMarks,
  verifyEvidence,
  verifyByRegisterNumber,
  listCalibrations,
  createCalibration,
  updateCalibration,
};
