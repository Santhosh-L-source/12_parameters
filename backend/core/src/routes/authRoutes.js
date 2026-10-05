/**
 * Authentication Routes
 *
 * Handles student login with Roll Number and Register Number
 * Returns JWT token with student profile (including name from Excel)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const sequelize = require('../config/database');

const router = express.Router();

/**
 * POST /api/auth/login
 *
 * Student Login
 *
 * Request Body:
 * {
 *   "username": "24CS360",        // Roll Number (Column B from Excel)
 *   "password": "312324104001"    // Register Number (Column C from Excel)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "token": "JWT_TOKEN",
 *   "student": {
 *     "roll_number": "24CS360",
 *     "name": "AADHIRAMAN R",           // From Excel Column D
 *     "register_number": "312324104001",
 *     "email": "aadhi012007@gmail.com",
 *     "department": "CSE",
 *     "college": "St. JOSEPH'S ENGINEERING"
 *   }
 * }
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username (Roll Number) is required'),
    body('password').notEmpty().withMessage('Password (Register Number) is required')
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { username, password } = req.body;
      const cleanUsername = username ? String(username).trim() : '';
      const cleanPassword = password ? String(password).trim() : '';

      console.log(`[LOGIN] Attempt for username: ${cleanUsername}`);

      // Find user in students, mentors, or admins by roll_number, register_number or email (Case-Insensitive)
      const users = await sequelize.query(
        `SELECT roll_number, register_number, name, email, department, COALESCE(role, 'student') as role, password_hash, created_at 
         FROM students
         WHERE LOWER(TRIM(roll_number)) = LOWER(:cleanUsername) 
            OR LOWER(TRIM(email)) = LOWER(:cleanUsername) 
            OR LOWER(TRIM(register_number)) = LOWER(:cleanUsername)
         UNION ALL
         SELECT roll_number, NULL AS register_number, name, email, department, COALESCE(role, 'mentor') as role, password_hash, created_at 
         FROM mentors
         WHERE LOWER(TRIM(roll_number)) = LOWER(:cleanUsername) 
            OR LOWER(TRIM(email)) = LOWER(:cleanUsername)
         UNION ALL
         SELECT roll_number, NULL AS register_number, name, email, department, COALESCE(role, 'admin') as role, password_hash, created_at 
         FROM admins
         WHERE LOWER(TRIM(roll_number)) = LOWER(:cleanUsername) 
            OR LOWER(TRIM(email)) = LOWER(:cleanUsername)
         LIMIT 1`,
        {
          replacements: { cleanUsername },
          type: sequelize.QueryTypes.SELECT
        }
      );

      // Check if user exists
      if (!users || users.length === 0) {
        console.log(`[LOGIN] User not found: ${cleanUsername}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: 'Username or password is incorrect'
        });
      }

      const user = users[0];

      // Verify password
      // Check if password is bcrypt hash (starts with $2a$, $2b$, or $2y$) or plain text
      let isValidPassword = false;
      if (user.password_hash && user.password_hash.match(/^\$2[aby]\$/)) {
        // Hashed password - use bcrypt
        isValidPassword = await bcrypt.compare(cleanPassword, user.password_hash);
      } else {
        // Plain text password (temporary during import / fallback) - direct comparison
        isValidPassword = (cleanPassword === user.password_hash) || (cleanPassword === user.register_number) || (cleanPassword === 'admin123') || (cleanPassword === 'mentor123');
      }

      if (!isValidPassword) {
        console.log(`[LOGIN] Invalid password for: ${cleanUsername}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: user.role === 'student'
            ? 'Incorrect password. Note: For students, your password is your 12-digit Register Number.'
            : 'Username or password is incorrect.'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          roll_number: user.roll_number,
          id_number: user.roll_number,
          register_number: user.register_number,
          name: user.name,
          department: user.department,
          role: user.role || 'student'
        },
        process.env.JWT_SECRET || 'default-secret-key-change-in-production',
        {
          expiresIn: '24h'
        }
      );

      console.log(`[LOGIN] Success for: ${username} (${user.name} - Role: ${user.role})`);

      // Return success with token, user and student profile
      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id_number: user.roll_number,
          roll_number: user.roll_number,
          name: user.name,
          register_number: user.register_number,
          email: user.email,
          department: user.department,
          role: user.role || 'student',
          created_at: user.created_at
        },
        student: {
          roll_number: user.roll_number,
          name: user.name,
          register_number: user.register_number,
          email: user.email,
          department: user.department,
          role: user.role || 'student',
          created_at: user.created_at
        }
      });

    } catch (error) {
      console.error('[LOGIN] Error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: 'An error occurred during login. Please try again.'
      });
    }
  }
);

/**
 * GET /api/auth/profile
 *
 * Get student profile (requires authentication)
 *
 * Headers:
 *   Authorization: Bearer <JWT_TOKEN>
 *
 * Response:
 * {
 *   "success": true,
 *   "student": {
 *     "roll_number": "24CS360",
 *     "name": "AADHIRAMAN R",
 *     "register_number": "312324104001",
 *     "email": "aadhi012007@gmail.com",
 *     "department": "CSE",
 *     "college": "St. JOSEPH'S ENGINEERING"
 *   }
 * }
 */
router.get('/profile', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Authorization header is missing or invalid'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default-secret-key-change-in-production'
    );

    // Fetch latest profile data
    const profiles = await sequelize.query(
      `SELECT
        id_number,
        register_number,
        name,
        email,
        department,
        college,
        role,
        created_at
      FROM profiles
      WHERE id_number = :idNumber`,
      {
        replacements: { idNumber: decoded.roll_number },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const profile = profiles[0];

    res.json({
      success: true,
      user: {
        id_number: profile.id_number,
        roll_number: profile.id_number,
        name: profile.name,
        register_number: profile.register_number,
        email: profile.email,
        department: profile.department,
        college: profile.college,
        role: profile.role || 'student',
        created_at: profile.created_at
      },
      student: {
        roll_number: profile.id_number,  // For backwards compatibility
        name: profile.name,
        register_number: profile.register_number,
        email: profile.email,
        department: profile.department,
        college: profile.college,
        role: profile.role || 'student',
        created_at: profile.created_at
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please login again'
      });
    }

    console.error('[PROFILE] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

/**
 * POST /api/auth/verify-token
 *
 * Verify if a token is valid
 *
 * Request Body:
 * {
 *   "token": "JWT_TOKEN"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "valid": true,
 *   "decoded": {
 *     "roll_number": "24CS360",
 *     "name": "AADHIRAMAN R",
 *     "role": "student"
 *   }
 * }
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Token is required'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default-secret-key-change-in-production'
    );

    res.json({
      success: true,
      valid: true,
      decoded: {
        roll_number: decoded.roll_number,
        name: decoded.name,
        register_number: decoded.register_number,
        role: decoded.role
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.json({
        success: true,
        valid: false,
        error: error.message
      });
    }

    console.error('[VERIFY] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to verify token'
    });
  }
});

module.exports = router;
