const axios = require('axios');

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Fetch GitHub user profile and contribution stats
 * @param {string} username - GitHub username
 * @returns {Promise<Object>} User data with stats
 */
async function fetchGitHubProfile(username) {
  try {
    // Get user profile
    const userRes = await axios.get(`${GITHUB_API}/users/${username}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 15000,
    });

    const user = userRes.data;

    // Get user's repositories
    const reposRes = await axios.get(`${GITHUB_API}/users/${username}/repos?per_page=100&sort=updated`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 15000,
    });

    const repos = reposRes.data;

    // Calculate total stars
    const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);

    // Get repos owned by user (not forked)
    const ownRepos = repos.filter(r => !r.fork);

    // Find repos with significant stars (potential OSS projects)
    const popularRepos = ownRepos
      .filter(r => r.stargazers_count >= 50)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 10);

    // Get merged pull requests to other repos (contributions)
    let externalPRs = [];
    try {
      const searchQuery = `author:${username} type:pr is:merged -user:${username}`;
      const prsRes = await axios.get(`${GITHUB_API}/search/issues`, {
        params: {
          q: searchQuery,
          per_page: 100,
          sort: 'created',
          order: 'desc',
        },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: 15000,
      });

      externalPRs = prsRes.data.items || [];
    } catch (err) {
      console.warn('Could not fetch external PRs:', err.message);
    }

    return {
      username: user.login,
      name: user.name,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      createdAt: user.created_at,
      profileUrl: user.html_url,
      avatarUrl: user.avatar_url,

      // Calculated stats
      totalStars,
      ownReposCount: ownRepos.length,
      forkedReposCount: repos.filter(r => r.fork).length,
      popularRepos: popularRepos.map(r => ({
        name: r.name,
        fullName: r.full_name,
        stars: r.stargazers_count,
        forks: r.forks_count,
        description: r.description,
        url: r.html_url,
        language: r.language,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),

      // External contributions
      externalPRsCount: externalPRs.length,
      externalPRs: externalPRs.slice(0, 20).map(pr => ({
        title: pr.title,
        url: pr.html_url,
        repo: pr.repository_url.split('/').slice(-2).join('/'),
        createdAt: pr.created_at,
        state: pr.state,
      })),
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`GitHub user '${username}' not found`);
    }
    if (error.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Try again later.');
    }
    throw new Error(`Failed to fetch GitHub data: ${error.message}`);
  }
}

/**
 * Analyze GitHub data and create PR summary
 * @param {Object} profileData - Data from fetchGitHubProfile
 * @returns {Object} PR summary with achievements
 */
function analyzeAchievements(profileData) {
  const mergedCount = profileData.externalPRsCount;
  const validCount = mergedCount; // For now, count all merged PRs as valid

  // Calculate marks based on merged PR count
  let marks = 0;
  if (mergedCount >= 5) marks = 15;
  else if (mergedCount >= 3) marks = 10;
  else if (mergedCount >= 1) marks = 5;
  else if (validCount >= 1) marks = 3;

  return {
    platform: 'GitHub',
    validPRsCount: validCount,
    mergedPRsCount: mergedCount,
    marks,
    externalPRs: profileData.externalPRs,
    profileUrl: profileData.profileUrl,
  };
}

module.exports = {
  fetchGitHubProfile,
  analyzeAchievements,
};
