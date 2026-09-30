const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

async function fetchAtCoder(profileUrl) {
  const handle = config.platforms.ATCODER.extractHandle(profileUrl);
  if (!handle) throw new Error(`Cannot extract AtCoder handle from: ${profileUrl}`);

  logger.info(`Fetching AtCoder stats for: ${handle}`);

  const url = `${config.platforms.ATCODER.apiBase}/user_info?user=${encodeURIComponent(handle)}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': config.userAgent },
    timeout: 15000,
  });

  const data = response.data;
  if (!data || data.user_id === undefined) {
    throw new Error(`AtCoder user not found: ${handle}`);
  }

  const totalSolved = data.accepted_count || 0;

  logger.info(`AtCoder ${handle}: total=${totalSolved}, sql=0 (no SQL on platform)`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: 0 };
}

module.exports = { fetchAtCoder };
