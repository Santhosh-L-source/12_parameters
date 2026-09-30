const pRetryModule = require('p-retry');
const pRetry = pRetryModule.default || pRetryModule;
const config = require('../config/config');
const logger = require('../utils/logger');

async function withRetry(fn, label = 'operation') {
  return pRetry(fn, {
    retries: config.retry.retries,
    minTimeout: config.retry.minTimeout,
    factor: 2,
    onFailedAttempt: (error) => {
      logger.warn(
        `${label} attempt ${error.attemptNumber}/${config.retry.retries + 1} failed: ${error.message}`
      );
    },
  });
}

module.exports = { withRetry };
