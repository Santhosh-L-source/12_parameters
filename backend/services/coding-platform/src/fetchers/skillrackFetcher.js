const axios = require('../utils/axiosAdapter');
const config = require('../config/config');
const logger = require('../utils/logger');

function parseSkillRackHtml(html) {
  let totalSolved = 0;
  let sqlSolved = 0;

  // Pattern 1: match statistic cards (<div class="value">2,384</div> ... <div class="label">PROGRAMS SOLVED</div>)
  const statRegex = /<div[^>]*class=["'][^"']*value[^"']*["'][^>]*>\s*([\d,]+)\s*<\/div>[\s\S]*?<div[^>]*class=["'][^"']*label[^"']*["'][^>]*>\s*([^<]+)\s*<\/div>/gi;
  let match;
  while ((match = statRegex.exec(html)) !== null) {
    const val = parseInt(match[1].replace(/,/g, ''), 10) || 0;
    const label = match[2].trim().toUpperCase();
    if (label === 'PROGRAMS SOLVED') totalSolved = val;
    if (label === 'SQL') sqlSolved = val;
  }

  // Pattern 2: reverse card order or fallback
  if (totalSolved === 0) {
    const mProg = html.match(/([\d,]+)\s*<\/div>\s*<div[^>]*>\s*PROGRAMS\s+SOLVED/i) ||
                  html.match(/PROGRAMS\s+SOLVED[\s\S]{0,100}?([\d,]+)/i);
    if (mProg) totalSolved = parseInt(mProg[1].replace(/,/g, ''), 10) || 0;
  }
  if (sqlSolved === 0) {
    const mSql = html.match(/([\d,]+)\s*<\/div>\s*<div[^>]*>\s*SQL\s*<\/div>/i) ||
                 html.match(/<div[^>]*>\s*SQL\s*<\/div>[\s\S]{0,100}?([\d,]+)/i);
    if (mSql) sqlSolved = parseInt(mSql[1].replace(/,/g, ''), 10) || 0;
  }

  return { totalSolved, sqlSolved };
}

async function fetchSkillRack(profileUrl) {
  const params = config.platforms.SKILLRACK.extractId(profileUrl);
  if (!params) throw new Error(`Cannot extract SkillRack id/key from: ${profileUrl}`);

  logger.info(`Fetching SkillRack stats for id: ${params.id}`);

  const url = `https://www.skillrack.com/faces/resume.xhtml?id=${params.id}&key=${params.key}`;
  const response = await axios.get(url, {
    headers: { 'User-Agent': config.userAgent },
    timeout: 15000,
  });

  const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
  const { totalSolved, sqlSolved } = parseSkillRackHtml(html);

  logger.info(`SkillRack ${params.id}: total=${totalSolved}, sql=${sqlSolved}`);
  return { totalProblemsSolved: totalSolved, sqlProblemsSolved: sqlSolved };
}

module.exports = { fetchSkillRack, parseSkillRackHtml };
