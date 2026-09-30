try { require('dotenv').config(); } catch (e) {}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'hope_evidence',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    storagePath: process.env.DB_STORAGE || './hope_evidence.sqlite',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'coding-evidence-service',
    groupId: process.env.KAFKA_GROUP_ID || 'coding-evidence-consumer',
    topics: {
      fetchRequested: 'coding-evidence.fetch-requested',
      fetchCompleted: 'coding-evidence.fetch-completed',
      fetchFailed: 'coding-evidence.fetch-failed',
    },
  },

  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 30000,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  },

  circuitBreaker: {
    errorThresholdPercentage: parseInt(process.env.CB_ERROR_THRESHOLD, 10) || 50,
    resetTimeout: parseInt(process.env.CB_RESET_TIMEOUT, 10) || 30000,
    timeout: parseInt(process.env.CB_TIMEOUT, 10) || 20000,
  },

  retry: {
    retries: parseInt(process.env.RETRY_ATTEMPTS, 10) || 3,
    minTimeout: parseInt(process.env.RETRY_MIN_TIMEOUT, 10) || 1000,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'hope-project-dev-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  verification: {
    tokenExpiryMinutes: parseInt(process.env.VERIFICATION_EXPIRY_MINUTES, 10) || 10,
    maxAttemptsPerHour: parseInt(process.env.VERIFICATION_MAX_ATTEMPTS, 10) || 10,
  },

  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',

  platforms: {
    LEETCODE: {
      graphqlUrl: 'https://leetcode.com/graphql',
      extractHandle: (url) => {
        const match = url.match(/leetcode\.com\/u\/([^/]+)/);
        return match ? match[1] : url.match(/leetcode\.com\/([^/]+)/)?.[1];
      },
    },
    CODEFORCES: {
      apiBase: 'https://codeforces.com/api',
      extractHandle: (url) => {
        const match = url.match(/codeforces\.com\/profile\/([^/]+)/);
        return match ? match[1] : null;
      },
    },
    ATCODER: {
      apiBase: 'https://kenkoooo.com/atcoder/atcoder-api/v3',
      extractHandle: (url) => {
        const match = url.match(/atcoder\.jp\/users\/([^/?]+)/);
        return match ? match[1] : null;
      },
    },
    CODECHEF: {
      extractHandle: (url) => {
        const match = url.match(/codechef\.com\/users\/([^/?]+)/);
        return match ? match[1] : null;
      },
      selectors: {
        totalSolved: '.rating-data-section.problems-solved h3:first-of-type',
        totalSolvedValue: '.rating-data-section.problems-solved .content',
      },
    },
    HACKERRANK: {
      apiBase: 'https://www.hackerrank.com/rest/hackers',
      extractHandle: (url) => {
        const match = url.match(/hackerrank\.com\/profile\/([^/?]+)/);
        return match ? match[1] : null;
      },
    },
    GEEKSFORGEEKS: {
      extractHandle: (url) => {
        const match = url.match(/geeksforgeeks\.org\/(?:user|profile)\/([^/?]+)/);
        return match ? match[1] : null;
      },
      selectors: {
        totalSolved: '.scoreCard_head_left--score__oSi_x',
        solvedStats: '.solvedProblemContainer_head__ZyIn0',
      },
    },
    SKILLRACK: {
      extractId: (url) => {
        const idMatch = url.match(/[?&]id=(\d+)/);
        const keyMatch = url.match(/[?&]key=([a-f0-9]+)/);
        return idMatch && keyMatch ? { id: idMatch[1], key: keyMatch[1] } : null;
      },
    },
  },
};
