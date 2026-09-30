'use strict';

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { isEnglishVariant, calculateParameterScore } = require('../services/languageScoringService');

const router = express.Router();

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabase;
}

// ── GET /api/evidence/language?register_number=X&semester=Y ─────────────────
router.get('/', async (req, res) => {
  const { register_number, semester } = req.query;
  if (!register_number || !semester) {
    return res.status(400).json({ error: 'register_number and semester are required.' });
  }

  const { data, error } = await getSupabase()
    .from('language_evidence')
    .select('*')
    .eq('register_number', register_number.trim())
    .eq('semester', semester.trim())
    .order('submitted_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const approved = (data || []).filter(r => r.status === 'APPROVED');
  const score = calculateParameterScore(approved);

  return res.json({ data: data || [], score });
});

// ── GET /api/evidence/language/all ──────────────────────────────────────────
router.get('/all', async (req, res) => {
  const { status, semester } = req.query;

  let query = getSupabase()
    .from('language_evidence')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (semester)                   query = query.eq('semester', semester);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ data: data || [] });
});

// ── POST /api/evidence/language ─────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    register_number, semester,
    language_name, cefr_level,
    certifying_body, jlpt_level, jlpt_score, cert_date,
    proof_url,
  } = req.body;

  if (!language_name || typeof language_name !== 'string' || !language_name.trim()) {
    return res.status(400).json({ error: 'language_name is required.' });
  }

  if (isEnglishVariant(language_name)) {
    return res.status(400).json({
      error:
        'English and English-equivalent tests (IELTS, TOEFL, PTE, etc.) do not qualify ' +
        'for the Foreign Language parameter. Submit them under External Aptitude instead.',
    });
  }

  if (!register_number || !semester || !cefr_level) {
    return res.status(400).json({ error: 'register_number, semester, and cefr_level are required.' });
  }

  const VALID_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!VALID_CEFR.includes(cefr_level)) {
    return res.status(400).json({ error: `cefr_level must be one of: ${VALID_CEFR.join(', ')}.` });
  }

  const VALID_JLPT = ['N1', 'N2', 'N3', 'N4', 'N5'];
  if (jlpt_level && !VALID_JLPT.includes(jlpt_level)) {
    return res.status(400).json({ error: `jlpt_level must be one of: ${VALID_JLPT.join(', ')}.` });
  }

  const { data, error } = await getSupabase()
    .from('language_evidence')
    .insert({
      register_number: register_number.trim(),
      semester: semester.trim(),
      language_name: language_name.trim(),
      cefr_level,
      certifying_body: certifying_body?.trim() || null,
      jlpt_level: jlpt_level || null,
      jlpt_score: jlpt_score ? parseInt(jlpt_score, 10) : null,
      cert_date: cert_date || null,
      proof_url: proof_url?.trim() || null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Language name failed database validation. English variants are not permitted.' });
    }
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ data });
});

// ── GET /api/evidence/language/marks/:studentId ─────────────────────────────
router.get('/marks/:studentId', async (req, res) => {
  const studentId = req.params.studentId;

  const { data, error } = await getSupabase()
    .from('language_evidence')
    .select('language_name_normalized, cefr_level')
    .eq('register_number', studentId.trim())
    .eq('status', 'APPROVED');

  if (error) return res.status(500).json({ error: error.message });

  const score = calculateParameterScore(data || []);

  return res.json({
    studentId,
    module: 'Foreign Language',
    maxMarks: 15,
    marks: score,
    evidenceCount: (data || []).length,
  });
});

// ── PUT /api/evidence/language/:id/verify ───────────────────────────────────
router.put('/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { status, mentor_id } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'status must be APPROVED or REJECTED.' });
  }
  if (!mentor_id) {
    return res.status(400).json({ error: 'mentor_id is required.' });
  }

  const db = getSupabase();

  const { data: existing, error: fetchError } = await db
    .from('language_evidence')
    .select('id, register_number, semester')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Evidence record not found.' });
  }

  const { data: updated, error: updateError } = await db
    .from('language_evidence')
    .update({ status, mentor_id, verified_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateError) return res.status(500).json({ error: updateError.message });

  const { data: approvedRows, error: rowsError } = await db
    .from('language_evidence')
    .select('language_name_normalized, cefr_level')
    .eq('register_number', existing.register_number)
    .eq('semester', existing.semester)
    .eq('status', 'APPROVED');

  if (rowsError) return res.status(500).json({ error: rowsError.message });

  const score = calculateParameterScore(approvedRows || []);

  const { error: scoreError } = await db
    .from('scores')
    .upsert(
      {
        register_number: existing.register_number,
        semester: existing.semester,
        parameter: 'foreign_language',
        marks: score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'register_number,semester,parameter' },
    );

  if (scoreError) return res.status(500).json({ error: scoreError.message });

  return res.status(200).json({ data: updated, score });
});

module.exports = router;
