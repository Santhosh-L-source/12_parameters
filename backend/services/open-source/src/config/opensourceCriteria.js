// Open Source Contribution Criteria
// Milestone-based on merged PRs count

const MILESTONES = [
  {
    marks: 3,
    label: '1 Valid PR',
    requirement: '1 valid PR submitted to an approved external repository',
    minValidPRs: 1,
    minMergedPRs: 0,
  },
  {
    marks: 5,
    label: '1 Merged PR',
    requirement: '1 PR merged by an external maintainer',
    minValidPRs: 1,
    minMergedPRs: 1,
  },
  {
    marks: 10,
    label: '3 Merged PRs',
    requirement: '3 merged PRs',
    minValidPRs: 3,
    minMergedPRs: 3,
  },
  {
    marks: 15,
    label: '5+ Merged PRs',
    requirement: '5+ merged PRs',
    minValidPRs: 5,
    minMergedPRs: 5,
  },
  {
    marks: 17,
    label: 'Programme Selection',
    requirement: 'Selected as contributor in an approved open-source programme',
    type: 'PROGRAMME_SELECTED',
    requiresProof: ['Official selection details provided'],
  },
  {
    marks: 20,
    label: 'Maintainer/Completion',
    requirement: 'Recognised contributor/maintainer status, or successful completion of a selected programme',
    type: 'PROGRAMME_COMPLETED',
    requiresProof: ['Completion details provided', 'Contributor/maintainer details provided'],
  },
];

const MAX_MARKS = 20;

/**
 * Calculate marks based on merged PR count
 * @param {number} mergedPRs - Number of merged PRs
 * @returns {number} Marks earned
 */
function calculatePRMarks(mergedPRs) {
  let marks = 0;

  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const milestone = MILESTONES[i];
    if (milestone.minMergedPRs !== undefined && mergedPRs >= milestone.minMergedPRs) {
      marks = milestone.marks;
      break;
    }
  }

  return marks;
}

/**
 * Calculate marks for programme-based achievements
 * @param {string} type - PROGRAMME_SELECTED or PROGRAMME_COMPLETED
 * @returns {number} Marks earned
 */
function calculateProgrammeMarks(type) {
  const milestone = MILESTONES.find(m => m.type === type);
  return milestone ? milestone.marks : 0;
}

/**
 * Calculate total marks for a student
 * @param {Array} evidence - Array of evidence entries
 * @returns {Object} Marks breakdown
 */
function calculateTotalMarks(evidence) {
  let prMarks = 0;
  let programmeMarks = 0;

  // Count merged PRs
  const mergedCount = evidence.filter(e =>
    e.achievementType === 'MERGED_PR' && e.merged === true
  ).length;

  prMarks = calculatePRMarks(mergedCount);

  // Check for programme achievements (take highest)
  const hasCompleted = evidence.some(e => e.achievementType === 'PROGRAMME_COMPLETED');
  const hasSelected = evidence.some(e => e.achievementType === 'PROGRAMME_SELECTED');

  if (hasCompleted) {
    programmeMarks = calculateProgrammeMarks('PROGRAMME_COMPLETED');
  } else if (hasSelected) {
    programmeMarks = calculateProgrammeMarks('PROGRAMME_SELECTED');
  }

  // Total is MAX of PR marks and programme marks
  const totalMarks = Math.max(prMarks, programmeMarks);

  return {
    totalMarks: Math.min(totalMarks, MAX_MARKS),
    prMarks,
    programmeMarks,
    mergedCount,
    maxMarks: MAX_MARKS,
  };
}

/**
 * Get achieved milestone for given merged PR count
 */
function getAchievedMilestone(mergedPRs) {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const milestone = MILESTONES[i];
    if (milestone.minMergedPRs !== undefined && mergedPRs >= milestone.minMergedPRs) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get next milestone to achieve
 */
function getNextMilestone(mergedPRs) {
  for (const milestone of MILESTONES) {
    if (milestone.minMergedPRs !== undefined && mergedPRs < milestone.minMergedPRs) {
      return {
        ...milestone,
        gap: milestone.minMergedPRs - mergedPRs,
      };
    }
  }
  return null;
}

module.exports = {
  MILESTONES,
  MAX_MARKS,
  calculatePRMarks,
  calculateProgrammeMarks,
  calculateTotalMarks,
  getAchievedMilestone,
  getNextMilestone,
};
