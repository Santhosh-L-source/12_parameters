/**
 * Authentication Middleware
 *
 * Protects routes that require student authentication
 * Verifies JWT token and attaches student data to request
 */

const jwt = require('jsonwebtoken');
const sequelize = require('../config/database');

/**
 * Authenticate middleware
 *
 * Usage:
 *   const { authenticate } = require('../middleware/auth');
 *   router.get('/protected-route', authenticate, (req, res) => {
 *     // Access student data via req.user
 *     console.log(req.user.roll_number);
 *     console.log(req.user.name);
 *   });
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a valid token in Authorization header'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default-secret-key-change-in-production'
    );

    const idNumber = decoded.roll_number || decoded.id_number || decoded.id || decoded.userId || '';

    // Fetch latest user data from students, mentors, or admins
    const users = await sequelize.query(
      `SELECT roll_number, register_number, name, email, department, COALESCE(role, 'student') as role, mentor_roll_number as assigned_mentor_id, 
              CASE WHEN register_number LIKE '3124%' OR roll_number LIKE '3124%' THEN 'St. Joseph''s Institute of Technology' ELSE 'St. Joseph''s College of Engineering' END as college 
       FROM students
       WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(:idNumber))
       UNION ALL
       SELECT roll_number, NULL as register_number, name, email, department, COALESCE(role, 'mentor') as role, NULL as assigned_mentor_id, 'St. Joseph''s College of Engineering' as college 
       FROM mentors
       WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(:idNumber))
       UNION ALL
       SELECT roll_number, NULL as register_number, name, email, department, COALESCE(role, 'admin') as role, NULL as assigned_mentor_id, 'St. Joseph''s College of Engineering' as college 
       FROM admins
       WHERE LOWER(TRIM(roll_number)) = LOWER(TRIM(:idNumber))
       LIMIT 1`,
      {
        replacements: { idNumber: String(idNumber) },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'Your account may have been removed'
      });
    }

    const user = users[0];

    // Attach user data to request object
    req.user = {
      roll_number: user.roll_number,
      id_number: user.roll_number,
      name: user.name,
      register_number: user.register_number,
      email: user.email,
      department: user.department,
      college: user.college,
      role: user.role,
      assigned_mentor_id: user.assigned_mentor_id
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Your session is invalid. Please login again.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Your session has expired. Please login again.'
      });
    }

    console.error('[AUTH] Middleware error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Check role middleware
 *
 * Usage:
 *   const { authenticate, requireRole } = require('../middleware/auth');
 *   router.post('/admin-only', authenticate, requireRole('admin'), (req, res) => {
 *     // Only admins can access this route
 *   });
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: `This action requires ${allowedRoles.join(' or ')} role`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};
