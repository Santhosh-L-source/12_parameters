const jwt = require('jsonwebtoken');
const config = require('../config/config');
const Student = require('../models/Student');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    const student = await Student.findByPk(decoded.id);
    if (!student) {
      return res.status(401).json({ error: 'Student account not found' });
    }
    req.student = student;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired, please login again' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { requireAuth };
