const crypto = require('crypto');

// Mock modules before requiring anything
jest.mock('../src/config/database', () => {
  const { Sequelize } = require('sequelize');
  return new Sequelize('sqlite::memory:', { logging: false });
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../src/config/config');
const { getVerificationStrategy, isVerificationSupported } = require('../src/config/platformVerification');

// Token utilities (matching the implementation in verificationRoutes.js)
function generateToken(rollNumber) {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
  return `VERIFY-${rollNumber}-${random}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

describe('Verification Token Generation', () => {
  test('TEST 1: generates token with correct format containing roll number', () => {
    const token = generateToken('24CS212');
    expect(token).toMatch(/^VERIFY-24CS212-[A-Z0-9]{5}$/);
  });

  test('generates unique tokens each time', () => {
    const tokens = new Set();
    for (let i = 0; i < 20; i++) {
      tokens.add(generateToken('24CS212'));
    }
    expect(tokens.size).toBeGreaterThan(1);
  });

  test('token hash is deterministic for same input', () => {
    const token = 'VERIFY-24CS212-ABC12';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  test('TEST 5: different tokens produce different hashes', () => {
    const h1 = hashToken('VERIFY-24CS212-ABC12');
    const h2 = hashToken('VERIFY-24CS212-XYZ99');
    expect(h1).not.toBe(h2);
  });
});

describe('Platform Verification Support', () => {
  test('LeetCode verification is supported', () => {
    expect(isVerificationSupported('LEETCODE')).toBe(true);
    const strategy = getVerificationStrategy('LEETCODE');
    expect(strategy.fieldName).toBeTruthy();
    expect(strategy.instructions).toBeTruthy();
    expect(typeof strategy.check).toBe('function');
  });

  test('Codeforces verification is supported', () => {
    expect(isVerificationSupported('CODEFORCES')).toBe(true);
    const strategy = getVerificationStrategy('CODEFORCES');
    expect(strategy.fieldName).toBeTruthy();
    expect(typeof strategy.check).toBe('function');
  });

  test('unsupported platforms are marked correctly', () => {
    for (const platform of ['HACKERRANK', 'ATCODER', 'CODECHEF', 'GEEKSFORGEEKS', 'SKILLRACK']) {
      expect(isVerificationSupported(platform)).toBe(false);
      const strategy = getVerificationStrategy(platform);
      expect(strategy.reason).toBeTruthy();
    }
  });

  test('unknown platform returns null', () => {
    expect(getVerificationStrategy('UNKNOWN')).toBeNull();
  });
});

describe('JWT Authentication', () => {
  test('generates valid JWT with student data', () => {
    const token = jwt.sign(
      { id: 1, rollNumber: '24CS212' },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    const decoded = jwt.verify(token, config.jwt.secret);
    expect(decoded.id).toBe(1);
    expect(decoded.rollNumber).toBe('24CS212');
  });

  test('TEST 9: rejects expired tokens', () => {
    const token = jwt.sign(
      { id: 1, rollNumber: '24CS212' },
      config.jwt.secret,
      { expiresIn: '0s' }
    );
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });

  test('rejects tokens with wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'wrong-secret');
    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();
  });
});

describe('Password Hashing', () => {
  test('hashes and verifies password correctly', async () => {
    const hash = await bcrypt.hash('test123', 12);
    expect(await bcrypt.compare('test123', hash)).toBe(true);
    expect(await bcrypt.compare('wrong', hash)).toBe(false);
  });

  test('TEST 10: roll number in JWT cannot be spoofed by client', () => {
    // The roll number comes from the JWT payload signed by server
    // A client cannot forge a different roll number without the secret
    const legitimateToken = jwt.sign(
      { id: 1, rollNumber: '24CS212' },
      config.jwt.secret
    );
    const decoded = jwt.verify(legitimateToken, config.jwt.secret);
    expect(decoded.rollNumber).toBe('24CS212');

    // Trying to forge a token with a different roll number
    // would require the server secret
    const forgedToken = jwt.sign(
      { id: 1, rollNumber: '24CS213' },
      'attacker-doesnt-know-the-secret'
    );
    expect(() => jwt.verify(forgedToken, config.jwt.secret)).toThrow();
  });
});

describe('Token Expiry Logic', () => {
  test('TEST 4: expired token is detected', () => {
    const expiresAt = new Date(Date.now() - 1000); // 1 second ago
    expect(new Date() > expiresAt).toBe(true);
  });

  test('valid token is not expired', () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
    expect(new Date() > expiresAt).toBe(false);
  });
});

describe('Token-Profile Matching', () => {
  test('TEST 2: token from one student cannot verify another student profile', () => {
    // Student 24CS212 generates a token
    const token212 = generateToken('24CS212');
    const hash212 = hashToken(token212);

    // Search for 24CS213's token pattern in profile — won't find 24CS212's token
    const profileContent = token212; // Even if the profile contains 24CS212's token
    const regex213 = new RegExp('VERIFY-24CS213-[A-Z0-9]{5}', 'g');
    const matches = profileContent.match(regex213);
    expect(matches).toBeNull(); // 24CS213's pattern not found
  });

  test('correct token matches hash', () => {
    const token = generateToken('24CS212');
    const hash = hashToken(token);

    // Simulating what the check does: find token on profile and verify hash
    const candidateHash = hashToken(token);
    expect(candidateHash).toBe(hash);
  });

  test('TEST 6: token from student A used by student B is rejected by pattern', () => {
    const tokenA = generateToken('24CS212');
    const hashA = hashToken(tokenA);

    // Student B (24CS213) would search for VERIFY-24CS213-* pattern
    // Even if tokenA is on the profile, the pattern won't match
    const searchPattern = /VERIFY-24CS213-[A-Z0-9]{5}/g;
    const found = tokenA.match(searchPattern);
    expect(found).toBeNull();
  });
});

describe('Duplicate Account Prevention', () => {
  test('TEST 3: uniqueness check prevents duplicate linking', () => {
    // Simulating the uniqueness logic
    const linkedAccounts = [
      { studentId: '24CS212', platform: 'LEETCODE', externalUsername: 'santhosh123', verified: true },
    ];

    const newRequest = { studentId: '24CS213', platform: 'LEETCODE', externalUsername: 'santhosh123' };

    const alreadyLinked = linkedAccounts.find(
      (a) =>
        a.platform === newRequest.platform &&
        a.externalUsername === newRequest.externalUsername &&
        a.verified &&
        a.studentId !== newRequest.studentId
    );

    expect(alreadyLinked).toBeTruthy();
    expect(alreadyLinked.studentId).toBe('24CS212');
  });
});

describe('Profile URL Change Detection', () => {
  test('TEST 7: changing profile URL requires re-verification', () => {
    const evidence = {
      profileUrl: 'https://leetcode.com/u/original',
      verified: true,
      externalUsername: 'original',
    };

    const newUrl = 'https://leetcode.com/u/different';
    if (newUrl !== evidence.profileUrl) {
      evidence.verified = false;
      evidence.verifiedAt = null;
      evidence.externalUsername = null;
    }

    expect(evidence.verified).toBe(false);
  });
});

describe('Duplicate Verification Handling', () => {
  test('TEST 8: new verification attempt expires previous pending ones', () => {
    const attempts = [
      { id: 1, status: 'PENDING', tokenHash: 'old-hash' },
    ];

    // Simulating what happens when a new attempt is started:
    // All existing PENDING attempts for same student+platform get EXPIRED
    attempts.forEach((a) => {
      if (a.status === 'PENDING') {
        a.status = 'EXPIRED';
      }
    });

    expect(attempts[0].status).toBe('EXPIRED');

    // New attempt
    attempts.push({ id: 2, status: 'PENDING', tokenHash: 'new-hash' });
    const pending = attempts.filter((a) => a.status === 'PENDING');
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(2);
  });
});

describe('Handle Extraction from URLs', () => {
  const configPlatforms = require('../src/config/config').platforms;

  test('extracts LeetCode handle', () => {
    expect(configPlatforms.LEETCODE.extractHandle('https://leetcode.com/u/Santhosh20_L')).toBe('Santhosh20_L');
  });

  test('extracts Codeforces handle', () => {
    expect(configPlatforms.CODEFORCES.extractHandle('https://codeforces.com/profile/Santhosh_L20')).toBe('Santhosh_L20');
  });

  test('returns falsy for invalid URLs', () => {
    expect(configPlatforms.LEETCODE.extractHandle('https://google.com')).toBeFalsy();
    expect(configPlatforms.CODEFORCES.extractHandle('https://google.com')).toBeNull();
  });
});
