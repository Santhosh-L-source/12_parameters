import unicodedata
import re


def normalize(name: str) -> str:
    """
    Minimal normalization: NFD decompose → strip diacritics → lowercase →
    collapse whitespace. Does NOT reorder words or expand initials.
    """
    nfd = unicodedata.normalize('NFD', name)
    ascii_only = nfd.encode('ascii', 'ignore').decode('ascii')
    lower = ascii_only.lower()
    collapsed = re.sub(r'\s+', ' ', lower).strip()
    return collapsed


def exact_match(cert_name: str, registered_name: str) -> dict:
    """
    Returns {'match': bool, 'cert_name': str, 'registered_name': str,
             'reason': str}
    Only the harmless normalizations listed in STEP 3 are applied.
    """
    n_cert = normalize(cert_name)
    n_reg  = normalize(registered_name)

    if n_cert == n_reg:
        return {
            'match': True,
            'cert_name': cert_name,
            'registered_name': registered_name,
            'reason': 'Names match exactly.',
        }

    # Provide a specific reason for the mismatch
    reason = _describe_mismatch(n_cert, n_reg)
    return {
        'match': False,
        'cert_name': cert_name,
        'registered_name': registered_name,
        'reason': reason,
    }


def _describe_mismatch(a: str, b: str) -> str:
    words_a = set(a.split())
    words_b = set(b.split())
    if words_a == words_b:
        return 'Same words but in different order.'
    missing = words_b - words_a
    extra   = words_a - words_b
    parts = []
    if missing:
        parts.append(f"Word(s) in registered name not on certificate: {', '.join(sorted(missing))}")
    if extra:
        parts.append(f"Word(s) on certificate not in registered name: {', '.join(sorted(extra))}")
    if not parts:
        parts.append('Names differ — may be spelling variation or different script.')
    return ' | '.join(parts)


def find_best_name_in_ocr(ocr_data: dict, registered_name: str) -> dict:
    """
    Search OCR name_candidates for the closest match to the registered name.
    Returns the best candidate and whether it is an exact match.
    """
    candidates = ocr_data.get('name_candidates', [])
    # Also scan all lines for anything resembling the registered name
    all_lines = ocr_data.get('lines', [])
    reg_lower = normalize(registered_name)

    for line in all_lines:
        if reg_lower in normalize(line):
            candidates.insert(0, line)

    if not candidates:
        return {
            'found': False,
            'cert_name': None,
            'match': False,
            'reason': 'Could not detect a recipient name in the certificate.',
        }

    # Pick the candidate that is closest to the registered name
    best = min(candidates, key=lambda c: _edit_distance(normalize(c), reg_lower))
    result = exact_match(best, registered_name)
    result['found'] = True
    return result


def _edit_distance(s: str, t: str) -> int:
    m, n = len(s), len(t)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[0]
        dp[0] = i
        for j in range(1, n + 1):
            temp = dp[j]
            dp[j] = prev if s[i-1] == t[j-1] else 1 + min(prev, dp[j], dp[j-1])
            prev = temp
    return dp[n]
