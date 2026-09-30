// Milestone-based CP Rating System
// Highest applicable milestone from ONE platform only. Ratings are never combined.

const MILESTONES = [
  {
    points: 5,
    label: 'Milestone 1',
    criteria: {
      CODEFORCES: { minRating: 1200, rank: 'Pupil', color: '#77DDBB' },
      CODECHEF: { minRating: 1400, rank: '2★', color: '#666666' },
      ATCODER: { minRating: 400, rank: 'Brown', color: '#804000' },
    }
  },
  {
    points: 10,
    label: 'Milestone 2',
    criteria: {
      CODEFORCES: { minRating: 1400, rank: 'Specialist', color: '#77DDBB' },
      CODECHEF: { minRating: 1600, rank: '3★', color: '#1E7D22' },
      ATCODER: { minRating: 800, rank: 'Green', color: '#008000' },
    }
  },
  {
    points: 15,
    label: 'Milestone 3',
    criteria: {
      CODEFORCES: { minRating: 1600, rank: 'Expert', color: '#AAAAFF' },
      CODECHEF: { minRating: 1800, rank: '4★', color: '#3366CC' },
      ATCODER: { minRating: 1200, rank: 'Cyan', color: '#00C0C0' },
      LEETCODE: { minRating: 1850, rank: 'Knight (top 25%)', percentile: 75, color: '#ffa116' },
    }
  },
  {
    points: 20,
    label: 'Milestone 4',
    criteria: {
      CODEFORCES: { minRating: 1900, rank: 'Candidate Master', color: '#FF88FF' },
      CODECHEF: { minRating: 2000, rank: '5★', color: '#684273' },
      ATCODER: { minRating: 1600, rank: 'Blue', color: '#0000FF' },
      LEETCODE: { minRating: 2150, rank: 'Guardian (top 5%)', percentile: 95, color: '#ffa116' },
    }
  },
];

const VALID_PLATFORMS = ['CODEFORCES', 'CODECHEF', 'ATCODER', 'LEETCODE'];
const MAX_MARKS = 20;

/**
 * Calculate marks for a single platform based on milestones
 */
function calculatePlatformMarks(platform, rating) {
  const platformUpper = platform.toUpperCase();
  let marks = 0;

  // Check each milestone from highest to lowest
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const milestone = MILESTONES[i];
    const criteria = milestone.criteria[platformUpper];

    if (criteria && rating >= criteria.minRating) {
      marks = milestone.points;
      break;
    }
  }

  return marks;
}

/**
 * Calculate student's total marks - HIGHEST milestone from ANY platform
 */
function calculateStudentCPMarks(evidenceList) {
  if (!evidenceList || evidenceList.length === 0) return 0;

  let maxMarks = 0;

  for (const ev of evidenceList) {
    const marks = calculatePlatformMarks(ev.platform, ev.currentRating);
    if (marks > maxMarks) {
      maxMarks = marks;
    }
  }

  return maxMarks;
}

/**
 * Get achieved milestone for a platform
 */
function getAchievedMilestone(platform, rating) {
  const platformUpper = platform.toUpperCase();

  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const milestone = MILESTONES[i];
    const criteria = milestone.criteria[platformUpper];

    if (criteria && rating >= criteria.minRating) {
      return {
        points: milestone.points,
        rank: criteria.rank,
        color: criteria.color,
        label: milestone.label,
      };
    }
  }

  return null;
}

/**
 * Get next milestone for a platform
 */
function getNextMilestone(platform, rating) {
  const platformUpper = platform.toUpperCase();

  for (const milestone of MILESTONES) {
    const criteria = milestone.criteria[platformUpper];
    if (criteria && rating < criteria.minRating) {
      return {
        points: milestone.points,
        rank: criteria.rank,
        minRating: criteria.minRating,
        gap: criteria.minRating - rating,
        label: milestone.label,
      };
    }
  }

  return null;
}

module.exports = {
  MILESTONES,
  VALID_PLATFORMS,
  MAX_MARKS,
  calculatePlatformMarks,
  calculateStudentCPMarks,
  getAchievedMilestone,
  getNextMilestone,
};
