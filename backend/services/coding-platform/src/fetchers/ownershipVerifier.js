const axios = require('../utils/axiosAdapter');
const config = require('../config/config');
const logger = require('../utils/logger');
const { verifyLeetCodeOwnership } = require('./leetcodeFetcher');

/**
 * Codeforces: Verifies if token is in user info (First Name, Last Name, Organization, City)
 */
async function verifyCodeforcesOwnership(profileUrl, expectedToken) {
  const handle = config.platforms.CODEFORCES.extractHandle(profileUrl);
  if (!handle) return { verified: false, reason: 'Invalid Codeforces URL' };

  try {
    const url = `${config.platforms.CODEFORCES.apiBase}/user.info?handles=${encodeURIComponent(handle)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 10000,
    });
    if (response.data && response.data.status === 'OK' && response.data.result?.[0]) {
      const u = response.data.result[0];
      const combined = `${u.firstName || ''} ${u.lastName || ''} ${u.organization || ''} ${u.city || ''}`.toUpperCase();
      if (combined.includes(expectedToken.trim().toUpperCase())) {
        return { verified: true, handle };
      }
    }
    return {
      verified: false,
      reason: `Verification code "${expectedToken}" was not found in Codeforces First/Last Name, Organization, or City for handle @${handle}.`,
    };
  } catch (err) {
    logger.warn(`[OwnershipVerifier] Codeforces check error: ${err.message}`);
    return { verified: false, reason: `Could not verify Codeforces profile: ${err.message}` };
  }
}

/**
 * GeeksforGeeks: Verifies if token is present in profile HTML or bio
 */
async function verifyGeeksforGeeksOwnership(profileUrl, expectedToken) {
  const handle = config.platforms.GEEKSFORGEEKS.extractHandle(profileUrl);
  if (!handle) return { verified: false, reason: 'Invalid GeeksforGeeks URL' };

  try {
    const url = `https://www.geeksforgeeks.org/user/${encodeURIComponent(handle)}/`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 12000,
    });
    const body = (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).toUpperCase();
    if (body.includes(expectedToken.trim().toUpperCase())) {
      return { verified: true, handle };
    }
    return {
      verified: false,
      reason: `Verification code "${expectedToken}" was not found in GeeksforGeeks profile/bio for @${handle}.`,
    };
  } catch (err) {
    logger.warn(`[OwnershipVerifier] GeeksforGeeks check error: ${err.message}`);
    return { verified: false, reason: `Could not verify GeeksforGeeks profile: ${err.message}` };
  }
}

/**
 * CodeChef: Verifies if token is present in user page HTML/bio
 */
async function verifyCodeChefOwnership(profileUrl, expectedToken) {
  const handle = config.platforms.CODECHEF.extractHandle(profileUrl);
  if (!handle) return { verified: false, reason: 'Invalid CodeChef URL' };

  try {
    const url = `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 12000,
    });
    const body = (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).toUpperCase();
    if (body.includes(expectedToken.trim().toUpperCase())) {
      return { verified: true, handle };
    }
    return {
      verified: false,
      reason: `Verification code "${expectedToken}" was not found in CodeChef profile for @${handle}.`,
    };
  } catch (err) {
    logger.warn(`[OwnershipVerifier] CodeChef check error: ${err.message}`);
    return { verified: false, reason: `Could not verify CodeChef profile: ${err.message}` };
  }
}

/**
 * HackerRank: Verifies if token is present in HackerRank bio or personal info
 */
async function verifyHackerRankOwnership(profileUrl, expectedToken) {
  const handle = config.platforms.HACKERRANK.extractHandle(profileUrl);
  if (!handle) return { verified: false, reason: 'Invalid HackerRank URL' };

  try {
    const url = `${config.platforms.HACKERRANK.apiBase}/${encodeURIComponent(handle)}/profile`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 10000,
    }).catch(() => null);

    if (res?.data) {
      const data = res.data.model || res.data.personal || res.data || {};
      const text = `${data.bio || ''} ${data.name || ''} ${data.username || ''}`.toUpperCase();
      if (text.includes(expectedToken.trim().toUpperCase())) {
        return { verified: true, handle };
      }
    }

    // Fallback: Check profile page HTML
    const pageRes = await axios.get(`https://www.hackerrank.com/profile/${encodeURIComponent(handle)}`, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 10000,
    });
    const body = (typeof pageRes.data === 'string' ? pageRes.data : JSON.stringify(pageRes.data)).toUpperCase();
    if (body.includes(expectedToken.trim().toUpperCase())) {
      return { verified: true, handle };
    }

    return {
      verified: false,
      reason: `Verification code "${expectedToken}" was not found in HackerRank profile/bio for @${handle}.`,
    };
  } catch (err) {
    logger.warn(`[OwnershipVerifier] HackerRank check error: ${err.message}`);
    return { verified: false, reason: `Could not verify HackerRank profile: ${err.message}` };
  }
}

/**
 * AtCoder: Verifies if token is present in user page
 */
async function verifyAtCoderOwnership(profileUrl, expectedToken) {
  const handle = config.platforms.ATCODER.extractHandle(profileUrl);
  if (!handle) return { verified: false, reason: 'Invalid AtCoder URL' };

  try {
    const url = `https://atcoder.jp/users/${encodeURIComponent(handle)}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 12000,
    });
    const body = (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).toUpperCase();
    if (body.includes(expectedToken.trim().toUpperCase())) {
      return { verified: true, handle };
    }
    return {
      verified: false,
      reason: `Verification code "${expectedToken}" was not found in AtCoder profile for @${handle}.`,
    };
  } catch (err) {
    logger.warn(`[OwnershipVerifier] AtCoder check error: ${err.message}`);
    return { verified: false, reason: `Could not verify AtCoder profile: ${err.message}` };
  }
}

/**
 * SkillRack: Verifies token or secret key
 */
async function verifySkillRackOwnership(profileUrl, expectedToken) {
  if (!profileUrl) return { verified: false, reason: 'Invalid SkillRack URL' };
  const tokenUpper = (expectedToken || '').trim().toUpperCase();

  if (profileUrl.toUpperCase().includes(tokenUpper)) {
    return { verified: true };
  }

  try {
    const res = await axios.get(profileUrl, {
      headers: { 'User-Agent': config.userAgent },
      timeout: 12000,
    });
    const body = (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)).toUpperCase();
    if (body.includes(tokenUpper)) {
      return { verified: true };
    }
  } catch (_) {}

  return {
    verified: false,
    reason: `Verification code "${expectedToken}" was not found on your SkillRack resume/page.`,
  };
}

/**
 * Master Verification Dispatcher for all platforms
 */
async function verifyPlatformOwnership(platform, profileUrl, expectedToken) {
  const plat = (platform || '').trim().toUpperCase();

  switch (plat) {
    case 'LEETCODE':
      return verifyLeetCodeOwnership(profileUrl, expectedToken);
    case 'CODEFORCES':
      return verifyCodeforcesOwnership(profileUrl, expectedToken);
    case 'GEEKSFORGEEKS':
      return verifyGeeksforGeeksOwnership(profileUrl, expectedToken);
    case 'CODECHEF':
      return verifyCodeChefOwnership(profileUrl, expectedToken);
    case 'HACKERRANK':
      return verifyHackerRankOwnership(profileUrl, expectedToken);
    case 'ATCODER':
      return verifyAtCoderOwnership(profileUrl, expectedToken);
    case 'SKILLRACK':
      return verifySkillRackOwnership(profileUrl, expectedToken);
    default:
      return { verified: true }; // Generic fallback
  }
}

module.exports = {
  verifyPlatformOwnership,
  verifyLeetCodeOwnership,
  verifyCodeforcesOwnership,
  verifyGeeksforGeeksOwnership,
  verifyCodeChefOwnership,
  verifyHackerRankOwnership,
  verifyAtCoderOwnership,
  verifySkillRackOwnership,
};
