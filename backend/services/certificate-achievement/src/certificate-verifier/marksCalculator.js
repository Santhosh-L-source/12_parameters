const OVERALL_CAP = 20;
const FOUNDATION_CAP = 10;

function calculate(entry, level, running) {
  const tier = entry.tier || '';
  let base;

  if (tier === 'Academic') {
    if (!level) {
      return { marks_awarded: 0, updated_running: running,
        reason: 'NPTEL result level not detected on certificate.' };
    }
    const levelKey = level.toLowerCase().replace(/ /g, '');
    base = (entry.marks_by_level || {})[levelKey] || 0;
    if (base === 0) {
      return { marks_awarded: 0, updated_running: running,
        reason: `Unrecognised NPTEL level "${level}".` };
    }
  } else {
    base = entry.marks || 0;
  }

  if (base === 0) {
    return { marks_awarded: 0, updated_running: running,
      reason: 'No mark value defined for this entry.' };
  }

  const currentTotal = running.total || 0;
  const currentFoundation = running.foundation_total || 0;

  if (tier === 'Foundation') {
    const allowedFoundation = FOUNDATION_CAP - currentFoundation;
    if (allowedFoundation <= 0) {
      return { marks_awarded: 0, updated_running: running,
        reason: 'Foundation-tier cap of 10 marks already reached.' };
    }
    base = Math.min(base, allowedFoundation);
  }

  const allowedOverall = OVERALL_CAP - currentTotal;
  if (allowedOverall <= 0) {
    return { marks_awarded: 0, updated_running: running,
      reason: 'Overall cap of 20 marks already reached.' };
  }

  const awarded = Math.min(base, allowedOverall);

  const newRunning = {
    total: currentTotal + awarded,
    foundation_total: currentFoundation + (tier === 'Foundation' ? awarded : 0),
    seen: running.seen || new Set(),
  };

  let reason = `${awarded} mark(s) awarded - tier: ${tier}, base: ${base}.`;
  if (awarded < base) {
    reason += ` Capped from ${base} to ${awarded} due to overall limit.`;
  }

  return { marks_awarded: awarded, updated_running: newRunning, reason };
}

function freshRunning() {
  return { total: 0, foundation_total: 0, seen: new Set() };
}

module.exports = { calculate, freshRunning, OVERALL_CAP, FOUNDATION_CAP };
