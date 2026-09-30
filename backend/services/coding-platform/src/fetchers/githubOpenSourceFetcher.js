const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Extract GitHub username, repo, and PR number from any GitHub URL or handle
 */
function parseGitHubInput(input) {
  if (!input) return { username: null, repoName: null, prNumber: null, repoUrl: null, profileUrl: null };
  const str = input.trim();

  let username = null;
  let repoName = null;
  let prNumber = null;
  let repoUrl = null;
  let profileUrl = null;

  const prMatch = str.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  const repoMatch = str.match(/github\.com\/([^/]+)\/([^/]+)/i);
  const userMatch = str.match(/github\.com\/([^/?#]+)/i);

  if (prMatch) {
    username = prMatch[1];
    repoName = `${prMatch[1]}/${prMatch[2]}`;
    prNumber = parseInt(prMatch[3], 10);
    repoUrl = `https://github.com/${repoName}`;
    profileUrl = `https://github.com/${username}`;
  } else if (repoMatch && !['topics', 'trending', 'explore', 'marketplace', 'settings', 'orgs', 'pulls', 'issues'].includes(repoMatch[1].toLowerCase())) {
    username = repoMatch[1];
    repoName = `${repoMatch[1]}/${repoMatch[2]}`;
    repoUrl = `https://github.com/${repoName}`;
    profileUrl = `https://github.com/${username}`;
  } else if (userMatch) {
    username = userMatch[1].replace('@', '');
    profileUrl = `https://github.com/${username}`;
  } else {
    username = str.replace('@', '').trim();
    profileUrl = `https://github.com/${username}`;
  }

  return { username, repoName, prNumber, repoUrl, profileUrl };
}

/**
 * Fetch Open Source details and live contribution metrics from GitHub
 */
async function fetchGitHubOpenSourceStats(urlOrHandle, expectedAuthor = null) {
  const parsed = parseGitHubInput(urlOrHandle);
  let { username, repoName, prNumber, repoUrl, profileUrl } = parsed;

  const targetAuthor = expectedAuthor || username;

  if (!targetAuthor) {
    throw new Error(`Invalid GitHub URL or username provided: ${urlOrHandle}`);
  }

  logger.info(`Fetching GitHub Open Source stats for author: ${targetAuthor} (Target: ${urlOrHandle})`);

  let prsSubmitted = 0;
  let prsMerged = 0;
  let isMaintainer = false;
  let foundRepos = repoName ? [repoName] : [];
  let evidenceUrls = [urlOrHandle];

  const headers = {
    'User-Agent': config.userAgent || 'HOPE-Project-Platform',
    'Accept': 'application/vnd.github.v3+json, text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  // Strategy 1: Check if specific PR URL was provided
  if (prNumber && repoName) {
    try {
      const [owner, repo] = repoName.split('/');
      const prRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers,
        timeout: 10000,
        validateStatus: (s) => s < 500,
      });

      if (prRes.status === 200 && prRes.data) {
        const pr = prRes.data;
        const prAuthor = pr.user?.login;
        if (!expectedAuthor || (prAuthor && prAuthor.toLowerCase() === expectedAuthor.toLowerCase())) {
          prsSubmitted = 1;
          prsMerged = pr.merged ? 1 : 0;
          evidenceUrls.push(pr.html_url);
          logger.info(`PR #${prNumber} by ${prAuthor} in ${repoName}: merged=${pr.merged}`);
        } else {
          logger.warn(`PR #${prNumber} author mismatch: expected ${expectedAuthor}, got ${prAuthor}`);
        }
      }
    } catch (err) {
      logger.warn(`GitHub PR fetch API warning: ${err.message}`);
    }
  }

  // Strategy 2: If repo URL was provided, search for targetAuthor's PRs in THAT repo
  if (repoName && prsMerged === 0 && prsSubmitted === 0) {
    try {
      const repoMergedQuery = `type:pr+repo:${repoName}+author:${encodeURIComponent(targetAuthor)}+is:merged`;
      const rMergedRes = await axios.get(`https://api.github.com/search/issues?q=${repoMergedQuery}`, {
        headers,
        timeout: 10000,
        validateStatus: (s) => s < 500,
      });

      if (rMergedRes.status === 200 && rMergedRes.data) {
        prsMerged = rMergedRes.data.total_count || 0;
        if (rMergedRes.data.items && Array.isArray(rMergedRes.data.items)) {
          rMergedRes.data.items.slice(0, 5).forEach(item => {
            if (item.html_url && !evidenceUrls.includes(item.html_url)) evidenceUrls.push(item.html_url);
          });
        }
      }

      const repoAllQuery = `type:pr+repo:${repoName}+author:${encodeURIComponent(targetAuthor)}`;
      const rAllRes = await axios.get(`https://api.github.com/search/issues?q=${repoAllQuery}`, {
        headers,
        timeout: 10000,
        validateStatus: (s) => s < 500,
      });

      if (rAllRes.status === 200 && rAllRes.data) {
        prsSubmitted = rAllRes.data.total_count || 0;
      }
    } catch (err) {
      logger.warn(`GitHub repo-scoped PR Search warning: ${err.message}`);
    }
  }

  // Strategy 3: Query overall open-source contributions for targetAuthor
  if (prsMerged === 0 && prsSubmitted === 0) {
    try {
      const mergedQuery = `type:pr+author:${encodeURIComponent(targetAuthor)}+is:merged`;
      const mergedRes = await axios.get(`https://api.github.com/search/issues?q=${mergedQuery}`, {
        headers,
        timeout: 10000,
        validateStatus: (s) => s < 500,
      });

      if (mergedRes.status === 200 && mergedRes.data) {
        prsMerged = mergedRes.data.total_count || 0;
        if (mergedRes.data.items && Array.isArray(mergedRes.data.items)) {
          mergedRes.data.items.slice(0, 5).forEach(item => {
            if (item.html_url && !evidenceUrls.includes(item.html_url)) {
              evidenceUrls.push(item.html_url);
            }
            const rName = item.repository_url?.replace('https://api.github.com/repos/', '');
            if (rName && !foundRepos.includes(rName)) {
              foundRepos.push(rName);
            }
          });
        }
      }

      const allQuery = `type:pr+author:${encodeURIComponent(targetAuthor)}`;
      const allRes = await axios.get(`https://api.github.com/search/issues?q=${allQuery}`, {
        headers,
        timeout: 10000,
        validateStatus: (s) => s < 500,
      });

      if (allRes.status === 200 && allRes.data) {
        prsSubmitted = allRes.data.total_count || 0;
      }
    } catch (err) {
      logger.warn(`GitHub Search API warning: ${err.message}`);
    }
  }

  // Strategy 3: Check User Repositories & Maintainer status via User Profile API / Cheerio
  try {
    const userRes = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      timeout: 8000,
      validateStatus: (s) => s < 500,
    });

    if (userRes.status === 200 && userRes.data) {
      const publicRepos = userRes.data.public_repos || 0;
      if (publicRepos >= 3) {
        isMaintainer = true;
      }
    }
  } catch (err) {
    // Strategy 4: Fallback to Cheerio profile scrape
    try {
      const pageRes = await axios.get(`https://github.com/${encodeURIComponent(username)}`, {
        headers: { 'User-Agent': headers['User-Agent'] },
        timeout: 8000
      });
      const $ = cheerio.load(pageRes.data);
      const pinned = $('.pinned-item-list-item-content span.repo').length;
      if (pinned >= 2) isMaintainer = true;
    } catch (scrapeErr) {
      logger.warn(`Cheerio GitHub profile scrape warning: ${scrapeErr.message}`);
    }
  }

  prsSubmitted = Math.max(prsSubmitted, prsMerged);

  const selectedRepo = repoName || (foundRepos.length > 0 ? foundRepos[0] : `${username}/contributions`);
  const finalRepoUrl = repoUrl || (foundRepos.length > 0 ? `https://github.com/${foundRepos[0]}` : profileUrl);

  return {
    github_username: username,
    repo_name: selectedRepo,
    repo_url: finalRepoUrl,
    profile_url: profileUrl,
    prs_submitted: prsSubmitted,
    prs_merged: prsMerged,
    is_maintainer: isMaintainer,
    programme_selected: false,
    programme_completed: false,
    evidence_urls: evidenceUrls.filter(Boolean),
    status: 'VERIFIED',
  };
}

/**
 * Verify that the user owns the GitHub profile by checking for the verification token
 * in their GitHub bio, name, company, or profile text.
 */
async function verifyGitHubOwnership(username, expectedToken) {
  if (!username || !expectedToken) {
    return { verified: false, reason: 'Username and verification token are required' };
  }

  const cleanToken = expectedToken.trim().toUpperCase();
  const headers = {
    'User-Agent': config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  try {
    const pageRes = await axios.get(`https://github.com/${encodeURIComponent(username)}`, {
      headers,
      timeout: 10000,
    });

    const $ = cheerio.load(pageRes.data);
    const bioText = $('.user-profile-bio').text().trim().toUpperCase();
    const nameText = $('.vcard-fullname').text().trim().toUpperCase();
    const allProfileText = $('.vcard-names-container, .user-profile-bio, .js-profile-editable-area, .p-nickname, .p-org, .p-label').text().trim().replace(/\s+/g, ' ').toUpperCase();

    if (
      bioText.includes(cleanToken) ||
      nameText.includes(cleanToken) ||
      allProfileText.includes(cleanToken)
    ) {
      return { verified: true };
    }

    return {
      verified: false,
      reason: `Verification token "${expectedToken}" was not found in @${username}'s GitHub bio or profile.`,
    };
  } catch (err) {
    return {
      verified: false,
      reason: `Could not reach GitHub profile for @${username}: ${err.message}`,
    };
  }
}

module.exports = {
  parseGitHubInput,
  fetchGitHubOpenSourceStats,
  verifyGitHubOwnership,
};
