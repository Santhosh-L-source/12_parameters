/**
 * Hundred Days Training Programme — backend module
 *
 * Mount this in your main Express app:
 *   const hundredDays = require('./modules/hundred-days/backend/src');
 *   app.use('/api/admin/hundred-days', requireAdmin, hundredDays.adminRouter);
 *   app.use('/api/student/hundred-days', requireAuth, hundredDays.studentRouter);
 *
 * The app must expose a pg Pool via app.set('db', pool).
 * req.user must be set by your auth middleware with at minimum { id }.
 */
const adminRouter = require('./routes/adminRoutes');
const studentRouter = require('./routes/studentRoutes');

module.exports = { adminRouter, studentRouter };
