'use strict';

const { Router } = require('express');
const ctrl = require('../controllers/gateController');

const router = Router();

// File upload (uses service-role key — bypasses storage RLS)
router.post('/upload', ctrl.uploadProof);

// Dashboard marks endpoint
router.get('/marks/:studentId', ctrl.getMarks);

// Student
router.post('/evidence', ctrl.submitEvidence);
router.get('/evidence/search', ctrl.searchByRegisterNumber);
router.get('/evidence/:id', ctrl.getEvidence);

// Mentor verification — runs scoring on APPROVE
router.patch('/evidence/by-register/:registerNumber/verify', ctrl.verifyByRegisterNumber);
router.patch('/evidence/:id/verify', ctrl.verifyEvidence);

// Admin: branch calibration (Central Team)
router.get('/calibration', ctrl.listCalibrations);
router.post('/calibration', ctrl.createCalibration);
router.patch('/calibration/:id', ctrl.updateCalibration);

module.exports = router;
