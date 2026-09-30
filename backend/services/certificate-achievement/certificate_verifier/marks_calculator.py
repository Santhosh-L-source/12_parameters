"""
Marks calculation with all caps enforced.
  - Foundation tier total cap : 10
  - Overall total cap          : 20
  - Duplicate certs            : counted once
"""
from __future__ import annotations

OVERALL_CAP       = 20
FOUNDATION_CAP    = 10


def calculate(entry: dict, level: str | None, running: dict) -> dict:
    """
    entry   : the matched APPROVED_MATRIX entry
    level   : detected result level for NPTEL (e.g. 'elite+gold'), or None for industry
    running : {'total': int, 'foundation_total': int, 'seen': set[str]}

    Returns:
      {'marks_awarded': int, 'updated_running': dict, 'reason': str}
    """
    tier = entry.get('tier', '')

    # Determine base marks
    if tier == 'Academic':
        if not level:
            return {'marks_awarded': 0, 'updated_running': running,
                    'reason': 'NPTEL result level not detected on certificate.'}
        base = entry.get('marks_by_level', {}).get(level.lower().replace(' ', ''), 0)
        if base == 0:
            return {'marks_awarded': 0, 'updated_running': running,
                    'reason': f'Unrecognised NPTEL level "{level}".'}
    else:
        base = entry.get('marks', 0)

    if base == 0:
        return {'marks_awarded': 0, 'updated_running': running,
                'reason': 'No mark value defined for this entry.'}

    current_total      = running.get('total', 0)
    current_foundation = running.get('foundation_total', 0)

    # Foundation cap
    if tier == 'Foundation':
        allowed_foundation = FOUNDATION_CAP - current_foundation
        if allowed_foundation <= 0:
            return {'marks_awarded': 0, 'updated_running': running,
                    'reason': 'Foundation-tier cap of 10 marks already reached.'}
        base = min(base, allowed_foundation)

    # Overall cap
    allowed_overall = OVERALL_CAP - current_total
    if allowed_overall <= 0:
        return {'marks_awarded': 0, 'updated_running': running,
                'reason': 'Overall cap of 20 marks already reached.'}

    awarded = min(base, allowed_overall)

    new_running = {
        'total': current_total + awarded,
        'foundation_total': current_foundation + (awarded if tier == 'Foundation' else 0),
        'seen': running.get('seen', set()),
    }

    reason = f'{awarded} mark(s) awarded - tier: {tier}, base: {base}.'
    if awarded < base:
        reason += f' Capped from {base} to {awarded} due to overall limit.'

    return {
        'marks_awarded': awarded,
        'updated_running': new_running,
        'reason': reason,
    }


def fresh_running() -> dict:
    return {'total': 0, 'foundation_total': 0, 'seen': set()}
