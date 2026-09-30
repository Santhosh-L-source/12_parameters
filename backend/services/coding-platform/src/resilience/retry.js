const logger = require('../utils/logger');

async function withRetry(fn, label = 'operation', retries = 2) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > retries) throw error;
      logger.warn(
        `${label} attempt ${attempt}/${retries + 1} failed: ${error.message}`
      );
      await new Promise((res) => setTimeout(res, 500 * attempt));
    }
  }
}

module.exports = { withRetry };
