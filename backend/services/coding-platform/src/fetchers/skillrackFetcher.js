const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config/config');
const logger = require('../utils/logger');

async function fetchSkillRack(profileUrl) {
  const params = config.platforms.SKILLRACK.extractId(profileUrl);
  if (!params) throw new Error(`Cannot extract SkillRack id/key from: ${profileUrl}`);

  logger.info(`Fetching SkillRack stats for id: ${params.id}`);

  const url = `https://www.skillrack.com/faces/resume.xhtml?id=${params.id}&key=${params.key}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': config.userAgent },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);

  let totalSolved = 0;
  let sqlSolved = 0;

  $('.statistic').each((_, el) => {
    const label = $(el).find('.label').text().trim().toUpperCase();
    const valueText = $(el).find('.value').text().replace(/,/g, '').trim();
    const match = valueText.match(/\d+/);
    const value = match ? parseInt(match[0], 10) : 0;

    if (label === 'PROGRAMS SOLVED') {
      totalSolved = value;
    } else if (label === 'SQL') {
      sqlSolved = value;
    }
  });

  logger.info(`SkillRack ${params.id}: total=${totalSolved}, sql=${sqlSolved}`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: sqlSolved };
}

module.exports = { fetchSkillRack };
