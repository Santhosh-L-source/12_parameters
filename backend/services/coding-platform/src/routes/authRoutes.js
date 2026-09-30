const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const Student = require('../models/Student');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

function signToken(student) {
  return jwt.sign(
    { id: student.id, rollNumber: student.rollNumber },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('rollNumber')
      .trim()
      .notEmpty()
      .withMessage('Roll number is required')
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage('Roll number must be alphanumeric'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { rollNumber, name, email, password } = req.body;

      const existing = await Student.findOne({
        where: { rollNumber: rollNumber.toUpperCase() },
      });
      if (existing) {
        return res.status(409).json({ error: 'Roll number already registered' });
      }

      const emailExists = await Student.findOne({ where: { email } });
      if (emailExists) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const student = await Student.create({
        rollNumber: rollNumber.toUpperCase(),
        name,
        email,
        passwordHash,
      });

      const token = signToken(student);
      logger.info(`Student registered: ${student.rollNumber}`);

      res.status(201).json({
        message: 'Registration successful',
        token,
        student: student.toSafeJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { rollNumber, password } = req.body;

      const student = await Student.findOne({
        where: { rollNumber: rollNumber.toUpperCase() },
      });
      if (!student) {
        return res.status(401).json({ error: 'Invalid roll number or password' });
      }

      if (!student.passwordHash) {
        return res.status(401).json({
          error: 'No password has been set for this account. Please use "Forgot password" to set a password.',
        });
      }

      const valid = await bcrypt.compare(password, student.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid roll number or password' });
      }

      const token = signToken(student);
      logger.info(`Student logged in: ${student.rollNumber}`);

      res.json({
        message: 'Login successful',
        token,
        student: student.toSafeJSON(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/forgot-password or /api/auth/reset-password
router.post(
  ['/forgot-password', '/reset-password'],
  [
    body('rollNumber')
      .trim()
      .notEmpty()
      .withMessage('Roll number is required')
      .matches(/^[a-zA-Z0-9]+$/)
      .withMessage('Roll number must be alphanumeric'),
    body('email').isEmail().withMessage('Valid registered email is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { rollNumber, email, newPassword } = req.body;

      const student = await Student.findOne({
        where: { rollNumber: rollNumber.toUpperCase() },
      });

      if (!student || student.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        return res.status(404).json({
          error: 'No account found matching this roll number and email combination.',
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      student.passwordHash = passwordHash;
      await student.save();

      logger.info(`Password reset successfully for student: ${student.rollNumber}`);

      res.json({
        message: 'Password has been reset successfully. Please log in with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/auth/me — get current student from token
router.get('/me', requireAuth, (req, res) => {
  res.json({ student: req.student.toSafeJSON() });
});

module.exports = router;
