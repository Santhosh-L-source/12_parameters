"""
Functions to search the approved matrix from OCR text.
"""
from __future__ import annotations
import re
from .matrix import APPROVED_MATRIX
from .name_matcher import normalize


def find_cert_in_matrix(ocr_text: str) -> dict:
    """
    Search OCR text for any approved credential.
    Returns {'found': bool, 'entry': dict|None, 'matched_key': str|None,
             'detected_level': str|None, 'reason': str}
    """
    text_lower = normalize(ocr_text)

    best_key  = None
    best_entry = None
    best_score = 0

    for key, entry in APPROVED_MATRIX.items():
        # Check canonical key
        score = _score_match(text_lower, key)
        # Check aliases
        for alias in entry.get('aliases', []):
            alias_score = _score_match(text_lower, normalize(alias))
            score = max(score, alias_score)

        if score > best_score:
            best_score = score
            best_key   = key
            best_entry = entry

    THRESHOLD = 0.6  # fraction of key words that must appear

    if best_score >= THRESHOLD:
        level = _detect_level(text_lower, best_entry)
        return {
            'found': True,
            'entry': best_entry,
            'matched_key': best_key,
            'detected_level': level,
            'reason': f'Matched "{best_key}" (confidence {best_score:.0%}).',
        }

    return {
        'found': False,
        'entry': None,
        'matched_key': None,
        'detected_level': None,
        'reason': 'No approved certification matched the text on this certificate.',
    }


def _score_match(text: str, key: str) -> float:
    """Fraction of key words found in text."""
    words = [w for w in key.split() if len(w) > 2]  # skip short words
    if not words:
        return 0.0
    hits = sum(1 for w in words if re.search(r'\b' + re.escape(w) + r'\b', text))
    return hits / len(words)


def _detect_level(text: str, entry: dict) -> str | None:
    """Detect NPTEL result level from OCR text."""
    if entry.get('tier') != 'Academic':
        return None
    levels = [
        ('elite+gold',   r'elite.*gold|gold.*elite'),
        ('elite+silver',  r'elite.*silver|silver.*elite'),
        ('elite',         r'\belite\b'),
        ('gold',          r'\bgold\b'),
        ('silver',        r'\bsilver\b'),
        ('completed',     r'\bcompleted\b|\bpass\b'),
    ]
    for name, pattern in levels:
        if re.search(pattern, text, re.I):
            return name
    return None
