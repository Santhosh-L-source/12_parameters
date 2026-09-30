const app = require('../backend/core/src/index');

// Ensure Vercel NFT bundles coding platform services
try {
  require('../backend/services/coding-platform/src/fetchers');
} catch (e) {
  console.warn('Coding platform fetchers preload:', e.message);
}

module.exports = app;
