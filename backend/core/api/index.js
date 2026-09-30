let app;
let initError = null;

try {
  app = require('../src/index');
} catch (err) {
  console.error('INITIALIZATION FAILED:', err);
  initError = err;
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      success: false,
      error: 'Backend initialization error on Vercel Serverless',
      message: initError.message,
      stack: initError.stack
    });
  }
  return app(req, res);
};
