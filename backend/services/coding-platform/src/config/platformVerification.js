const axios = require('axios');
const config = require('./config');
const logger = require('../utils/logger');

const VERIFICATION_STRATEGIES = {
  LEETCODE: {
    supported: true,
    fieldName: 'Summary / About Me',
    instructions: [
      'Go to leetcode.com and log in',
      'Click your avatar (top-right) → Profile',
      'Click "Edit Profile"',
      'In the "Summary" or "About Me" field, paste the verification code',
      'Click Save',
    ],
    check: async (username, expectedToken) => {
      const res = await axios.post(
        'https://leetcode.com/graphql',
        {
          query: `query { matchedUser(username: "${username.replace(/"/g, '')}") { profile { aboutMe } } }`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': config.userAgent,
          },
          timeout: 15000,
        }
      );
      const aboutMe = res.data?.data?.matchedUser?.profile?.aboutMe || '';
      return aboutMe.includes(expectedToken);
    },
  },

  CODEFORCES: {
    supported: true,
    fieldName: 'First Name',
    instructions: [
      'Go to codeforces.com and log in',
      'Click your handle (top-right) → Settings',
      'Go to the "Social" tab',
      'In the "First name" field, paste the verification code',
      'Click Save',
      '(You can restore your real name after verification)',
    ],
    check: async (handle, expectedToken) => {
      const res = await axios.get(
        `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`,
        { headers: { 'User-Agent': config.userAgent }, timeout: 15000 }
      );
      if (res.data.status !== 'OK' || !res.data.result?.length) {
        throw new Error('Codeforces user not found');
      }
      const user = res.data.result[0];
      const fields = [
        user.firstName,
        user.lastName,
        user.organization,
      ].filter(Boolean).join(' ');
      return fields.includes(expectedToken);
    },
  },

  GEEKSFORGEEKS: {
    supported: true,
    fieldName: 'Institute / School / Organization',
    instructions: [
      'Go to geeksforgeeks.org and log in',
      'Click your profile picture (top-right) → Profile',
      'Click "Edit Profile"',
      'In ANY text field (Institute Name, School, Organization, etc.), paste the verification code',
      'Click "Update Profile" or "Save"',
      '(You can restore your original information after verification)',
    ],
    check: async (handle, expectedToken) => {
      // Use API which is more reliable than scraping
      const res = await axios.get(
        `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(handle)}`,
        { headers: { 'User-Agent': config.userAgent }, timeout: 15000 }
      );
      const data = res.data?.data;
      if (!data) throw new Error('GeeksforGeeks user not found');

      // Check all text fields that users can edit
      const searchableFields = [
        data.institute_name,
        data.organization_name,
        data.school,
        data.name, // Name field
        data.designation,
      ].filter(Boolean).join(' ');

      return searchableFields.includes(expectedToken);
    },
  },

  ATCODER: {
    supported: true,
    fieldName: 'Affiliation',
    instructions: [
      'Go to atcoder.jp and log in',
      'Click your username (top-right) → Settings',
      'Scroll to "Affiliation" field',
      'Paste the verification code in the Affiliation field',
      'Click "Update" at the bottom',
      '(You can restore your real affiliation after verification)',
    ],
    check: async (handle, expectedToken) => {
      const cheerio = require('cheerio');
      const res = await axios.get(
        `https://atcoder.jp/users/${encodeURIComponent(handle)}`,
        { headers: { 'User-Agent': config.userAgent }, timeout: 15000 }
      );
      const $ = cheerio.load(res.data);
      let affiliation = '';
      $('table tr').each((i, el) => {
        const th = $(el).find('th').text().trim();
        const td = $(el).find('td').text().trim();
        if (th === 'Affiliation') {
          affiliation = td;
        }
      });
      return affiliation.includes(expectedToken);
    },
  },

  CODECHEF: {
    supported: true,
    fieldName: 'School / Organization',
    instructions: [
      'Go to codechef.com and log in',
      'Click your username (top-right) → View Profile → Edit Profile',
      'Scroll to "School" or "Organization" field',
      'Paste the verification code',
      'Click "Update Profile"',
      '(You can restore your real school/organization after verification)',
    ],
    check: async (handle, expectedToken) => {
      const { withPage } = require('../fetchers/browserPool');
      return withPage(async (page) => {
        await page.goto(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        const content = await page.evaluate(() => document.body.innerText);
        return content.includes(expectedToken);
      });
    },
  },

  HACKERRANK: {
    supported: true,
    fieldName: 'First Name / Last Name',
    instructions: [
      'Go to hackerrank.com and log in',
      'Click your profile picture (top-right) → Settings',
      'Go to "Personal Information" section',
      'In the "First Name" or "Last Name" field, paste the verification code',
      'Click "Save Changes"',
      '(You can restore your real name after verification)',
    ],
    check: async (handle, expectedToken) => {
      const { withPage } = require('../fetchers/browserPool');
      return withPage(async (page) => {
        // Set stealth mode
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        try {
          await page.goto(`https://www.hackerrank.com/profile/${encodeURIComponent(handle)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000,
          });
        } catch (err) {
          // Try the alternate URL format
          await page.goto(`https://www.hackerrank.com/${encodeURIComponent(handle)}`, {
            waitUntil: 'networkidle0',
            timeout: 30000,
          });
        }

        // Wait for profile content to load
        try {
          await page.waitForSelector('h1, .profile-heading, [class*="profile"]', { timeout: 10000 });
        } catch (e) {
          // Continue
        }

        // Wait for JS to render
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract name from the profile page
        const nameText = await page.evaluate(() => {
          const nameSelectors = [
            'h1.profile-heading',
            '.hacker-name',
            'h1',
            '.profile-name',
            '[class*="ProfileHeading"]',
            '[class*="profile-name"]'
          ];

          for (const selector of nameSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim() && element.textContent.trim().length > 2) {
              return element.textContent.trim();
            }
          }

          return document.body.innerText;
        });

        return nameText.includes(expectedToken);
      });
    },
  },

  SKILLRACK: {
    supported: true,
    fieldName: 'College Name / About',
    instructions: [
      'Go to skillrack.com and log in',
      'Click "My Profile" or "Edit Profile"',
      'In any editable text field (College, About, Bio, City, etc.), add the verification code',
      'Click "Save" or "Update"',
      '(You can restore your original information after verification)',
    ],
    check: async (profileUrl, expectedToken) => {
      const { withPage } = require('../fetchers/browserPool');
      return withPage(async (page) => {
        await page.goto(profileUrl, {
          waitUntil: 'networkidle2',
          timeout: 20000,
        });
        const content = await page.evaluate(() => document.body.innerText);
        return content.includes(expectedToken);
      });
    },
  },
};

function getVerificationStrategy(platform) {
  return VERIFICATION_STRATEGIES[platform] || null;
}

function isVerificationSupported(platform) {
  const strategy = VERIFICATION_STRATEGIES[platform];
  return strategy?.supported === true;
}

module.exports = { VERIFICATION_STRATEGIES, getVerificationStrategy, isVerificationSupported };
