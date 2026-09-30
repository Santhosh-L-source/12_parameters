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

    // Fetch latest user data from profiles table (single source of truth)
    const profiles = await sequelize.query(
      `SELECT
        id_number,
        role,
        register_number,
        name,
        email,
        department,
        college,
        assigned_mentor_id
      FROM profiles
      WHERE LOWER(TRIM(id_number)) = LOWER(TRIM(:idNumber))`,
      {
        replacements: { idNumber: String(idNumber) },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!profiles || profiles.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
        message: 'Your account may have been removed'
      });
    }

    // Attach user data to request object
    req.user = {
      roll_number: profiles[0].id_number,  // For backwards compatibility
      id_number: profiles[0].id_number,
      name: profiles[0].name,
      register_number: profiles[0].register_number,
      email: profiles[0].email,
      department: profiles[0].department,
      college: profiles[0].college,
      role: profiles[0].role,
      assigned_mentor_id: profiles[0].assigned_mentor_id
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
