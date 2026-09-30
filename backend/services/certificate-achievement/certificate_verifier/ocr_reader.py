from __future__ import annotations
import re
import io
import os
import cv2
import numpy as np
from PIL import Image
import easyocr

_reader = None

def _get_reader():
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    return _reader


def _pdf_to_images(pdf_path: str) -> list[np.ndarray]:
    """Convert every page of a PDF to a numpy BGR image using PyMuPDF."""
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    images = []
    for page in doc:
        # 2x zoom → ~144 dpi — good enough for certificate text
        mat = fitz.Matrix(2.5, 2.5)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        pil = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        images.append(img)
    return images


def _load_image(image_path: str) -> list[np.ndarray]:
    """Return list of BGR images from path (handles PDF and raster formats)."""
    ext = os.path.splitext(image_path)[1].lower()
    if ext == '.pdf':
        imgs = _pdf_to_images(image_path)
        if not imgs:
            raise ValueError(f"PDF has no pages: {image_path}")
        return imgs

    img = cv2.imread(image_path)
    if img is None:
        pil = Image.open(image_path).convert('RGB')
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return [img]


def _preprocess(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    h, w = denoised.shape
    if w < 1200:
        scale = 1200 / w
        denoised = cv2.resize(denoised, None, fx=scale, fy=scale,
                              interpolation=cv2.INTER_CUBIC)
    return denoised


def extract_text(image_path: str) -> dict:
    reader  = _get_reader()
    images  = _load_image(image_path)

    all_lines: list[str] = []
    for img in images:
        processed = _preprocess(img)
        results   = reader.readtext(processed, detail=1, paragraph=False)
        page_lines = [text.strip() for (_, text, conf) in results
                      if text.strip() and conf > 0.25]
        all_lines.extend(page_lines)

    lines    = all_lines
    raw_text = ' '.join(lines)

    lines = [text.strip() for (_, text, conf) in results
             if text.strip() and conf > 0.25]
    raw_text = ' '.join(lines)

    name_candidates = _extract_name_candidates(lines, raw_text)

    return {
        'raw_text': raw_text,
        'lines': lines,
        'name_candidates': name_candidates,
    }


# Phrases that immediately precede the recipient name on most certificates
_BEFORE_NAME = [
    r'this is to certify that',
    r'certif(?:ies|ied) that',
    r'awarded to',
    r'presented to',
    r'issued to',
    r'this certifies that',
    r'conferred upon',
    r'this certificate is awarded to',
    r'successfully completed by',
]

# Phrases that immediately follow the recipient name
_AFTER_NAME = [
    r'has (?:successfully )?(?:completed|earned|achieved|passed)',
    r'is hereby (?:awarded|certified)',
    r'for (?:successfully )?completing',
    r'having (?:successfully )?completed',
]


def _extract_name_candidates(lines: list[str], raw: str) -> list[str]:
    candidates = []

    # Strategy 1: Look for name between "certifies that … has completed" pattern
    combined = ' '.join(lines)
    before_pat = '|'.join(_BEFORE_NAME)
    after_pat  = '|'.join(_AFTER_NAME)
    m = re.search(
        rf'(?:{before_pat})\s+([A-Z][a-zA-Z .\'`-]{{3,60}}?)\s+(?:{after_pat})',
        combined, re.I
    )
    if m:
        candidates.append(m.group(1).strip())

    # Strategy 2: Scan individual lines — Title Case 2-4 word lines with no digits
    for line in lines:
        words = line.split()
        if (2 <= len(words) <= 5
                and not any(ch.isdigit() for ch in line)
                and all(w[0].isupper() for w in words if w)
                and not _is_cert_title(line)):
            candidates.append(line)

    # Strategy 3: Line directly after a "certifies that" line
    for i, line in enumerate(lines):
        if re.search(before_pat, line, re.I) and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if nxt and not re.search(before_pat + '|' + after_pat, nxt, re.I):
                candidates.append(nxt)

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for c in candidates:
        if c.lower() not in seen:
            seen.add(c.lower())
            unique.append(c)
    return unique


_CERT_TITLE_WORDS = {
    'aws', 'google', 'microsoft', 'cisco', 'oracle', 'comptia',
    'certified', 'certification', 'certificate', 'professional',
    'associate', 'foundation', 'engineer', 'architect', 'developer',
    'administrator', 'practitioner', 'nptel', 'swayam',
}

def _is_cert_title(line: str) -> bool:
    words = {w.lower() for w in line.split()}
    return bool(words & _CERT_TITLE_WORDS)
