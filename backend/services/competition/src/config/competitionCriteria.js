// Competition Achievement Criteria
// Accumulative scoring: distinct events accumulate to cap 20
// Same event contributes only its highest stage

const STAGES = [
  {
    marks: 2,
    label: 'Valid Completion',
    requirement: 'Valid completion in one approved event',
    stage: 'COMPLETED',
  },
  {
    marks: 4,
    label: 'Preliminary Round',
    requirement: 'Preliminary round cleared',
    stage: 'PRELIMINARY',
  },
  {
    marks: 6,
    label: 'Second/Intermediate Round',
    requirement: 'Second/intermediate round cleared',
    stage: 'INTERMEDIATE',
  },
  {
    marks: 10,
    label: 'Regional/State Finalist',
    requirement: 'Regional/state/college finalist or winner',
    stage: 'REGIONAL_FINALIST',
  },
  {
    marks: 15,
    label: 'National Finalist',
    requirement: 'National finalist/top rank',
    stage: 'NATIONAL_FINALIST',
  },
  {
    marks: 20,
    label: 'National/International Winner',
    requirement: 'National/international winner',
    stage: 'NATIONAL_WINNER',
  },
];

const MAX_MARKS = 20;

/**
 * Get marks for a specific stage
 */
function getMarksForStage(stage) {
  const found = STAGES.find(s => s.stage === stage);
  return found ? found.marks : 0;
}

/**
 * Calculate total marks using accumulative scoring
 * Rules:
 * - Distinct approved events accumulate to cap 20
 * - Same event contributes only its highest stage
 *
 * @param {Array} evidence - Array of competition evidence entries
 * @returns {Object} Marks breakdown
 */
function calculateTotalMarks(evidence) {
  if (!evidence || evidence.length === 0) {
    return {
      totalMarks: 0,
      maxMarks: MAX_MARKS,
      eventCount: 0,
      breakdown: [],
    };
  }

  // Group by event name
  const byEvent = {};
  evidence.forEach(ev => {
    const eventName = ev.eventName.toLowerCase().trim();
    if (!byEvent[eventName]) {
      byEvent[eventName] = [];
    }
    byEvent[eventName].push(ev);
  });

  // For each event, take only the highest stage
  const eventMarks = [];
  for (const eventName in byEvent) {
    const entries = byEvent[eventName];

    // Find highest marks for this event
    let highestMarks = 0;
    let bestEntry = null;

    entries.forEach(entry => {
      const marks = getMarksForStage(entry.stage);
      if (marks > highestMarks) {
        highestMarks = marks;
        bestEntry = entry;
      }
    });

    if (highestMarks > 0) {
      eventMarks.push({
        eventName: bestEntry.eventName,
        stage: bestEntry.stage,
        marks: highestMarks,
        level: bestEntry.level,
      });
    }
  }

  // Sum up marks from all distinct events, capped at MAX_MARKS
  const totalMarks = Math.min(
    eventMarks.reduce((sum, e) => sum + e.marks, 0),
    MAX_MARKS
  );

  return {
    totalMarks,
    maxMarks: MAX_MARKS,
    eventCount: eventMarks.length,
    breakdown: eventMarks,
  };
}

/**
 * Get stage details
 */
function getStageDetails(stage) {
  return STAGES.find(s => s.stage === stage) || null;
}

module.exports = {
  STAGES,
  MAX_MARKS,
  getMarksForStage,
  calculateTotalMarks,
  getStageDetails,
};
