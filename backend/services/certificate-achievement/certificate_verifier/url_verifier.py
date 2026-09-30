"""
URL / QR code verification.
Steps:
  1. Inspect domain safety before following any link.
  2. Fetch the public page (HTML, PDF or image).
  3. Extract credential fields — via HTML scraping OR OCR if the page is a PDF/image.
  4. Compare fields against the certificate data.
"""
from __future__ import annotations

import io
import os
import re
import tempfile
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from .matrix import SAFE_VERIFY_DOMAINS, BLOCKLISTED_DOMAINS, INELIGIBLE_PLATFORMS
from .name_matcher import normalize
from config import Config

MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024  # 8 MB cap for fetched docs


# ── Domain safety ────────────────────────────────────────────────────────────

def check_domain_safety(url: str) -> dict:
    try:
        parsed = urlparse(url if url.startswith('http') else 'https://' + url)
    except Exception:
        return {'safe': False, 'domain': '', 'reason': 'URL could not be parsed.'}

    domain = parsed.netloc.lower().lstrip('www.')
    scheme = parsed.scheme

    if scheme != 'https':
        return {'safe': False, 'domain': domain,
                'reason': f'URL does not use HTTPS (scheme: {scheme}).'}

    for bad in BLOCKLISTED_DOMAINS:
        if domain == bad or domain.endswith('.' + bad):
            return {'safe': False, 'domain': domain,
                    'reason': f'URL uses a blocklisted shortener/redirect domain: {domain}.'}

    for platform in INELIGIBLE_PLATFORMS:
        if domain == platform or domain.endswith('.' + platform):
            return {'safe': False, 'domain': domain,
                    'reason': (f'URL points to {domain}, which is a course-completion '
                               'platform, not an approved qualifying-exam issuer.')}

    is_safe = any(domain == sd or domain.endswith('.' + sd) for sd in SAFE_VERIFY_DOMAINS)
    if is_safe:
        return {'safe': True, 'domain': domain,
                'reason': 'Domain is an approved issuer or verification partner.'}

    return {'safe': False, 'domain': domain,
            'reason': (f'Domain "{domain}" is not in the approved issuer / '
                       'verification-partner list.')}


# ── HTTP fetch ────────────────────────────────────────────────────────────────

def _fetch_page(url: str) -> dict:
    try:
        resp = requests.get(
            url,
            headers=Config.SCRAPE_HEADERS,
            timeout=Config.REQUEST_TIMEOUT,
            allow_redirects=True,
            verify=True,
            stream=True,
        )
        # Read up to MAX_DOWNLOAD_BYTES
        chunks = []
        total  = 0
        for chunk in resp.iter_content(chunk_size=65536):
            chunks.append(chunk)
            total += len(chunk)
            if total > MAX_DOWNLOAD_BYTES:
                break
        raw_bytes    = b''.join(chunks)
        content_type = resp.headers.get('content-type', '').lower()
        status       = resp.status_code
        final_url    = resp.url

    except requests.exceptions.SSLError:
        return {'ok': False, 'reason': 'SSL certificate error on the verification page.'}
    except requests.exceptions.ConnectionError:
        return {'ok': False, 'reason': 'Could not connect to the verification URL.'}
    except requests.exceptions.Timeout:
        return {'ok': False, 'reason': 'Verification page timed out.'}
    except Exception as e:
        return {'ok': False, 'reason': f'Network error: {str(e)[:120]}'}

    if status >= 400:
        return {'ok': False, 'reason': f'Verification page returned HTTP {status}.'}

    return {
        'ok': True,
        'final_url': final_url,
        'content_type': content_type,
        'raw_bytes': raw_bytes,
        'text': raw_bytes.decode('utf-8', errors='replace') if 'html' in content_type else '',
    }


# ── Field extraction — HTML ────────────────────────────────────────────────────

def _extract_credly(soup: BeautifulSoup) -> dict:
    fields = {}
    for meta in soup.find_all('meta'):
        prop    = meta.get('property', '') or meta.get('name', '')
        content = meta.get('content', '')
        if 'title' in prop:
            fields['credential_name'] = content
        if 'description' in prop and not fields.get('holder_name'):
            m = re.search(r'issued to ([A-Za-z ]+)', content, re.I)
            if m:
                fields['holder_name'] = m.group(1).strip()
    name_tag = soup.select_one('.cr-badges-recipient-name, [data-cy="full-name"]')
    if name_tag:
        fields['holder_name'] = name_tag.get_text(strip=True)
    cert_tag = soup.select_one('.cr-badges-full-badge__title, [data-cy="badge-title"]')
    if cert_tag:
        fields['credential_name'] = cert_tag.get_text(strip=True)
    return fields


def _extract_microsoft(soup: BeautifulSoup) -> dict:
    fields = {}
    name_tag = soup.select_one('[data-bi-cn="learner_name"], .learner-name, h2')
    if name_tag:
        fields['holder_name'] = name_tag.get_text(strip=True)
    cert_tag = soup.select_one('.certification-title, h1')
    if cert_tag:
        fields['credential_name'] = cert_tag.get_text(strip=True)
    return fields


def _extract_from_html_text(text: str) -> dict:
    """Generic text extraction from HTML or any plain text."""
    fields = {}
    patterns_name = [
        r'(?:student\s*)?name\s*[:\-]\s*([A-Z][A-Za-z .\'`-]{2,50})',
        r'(?:issued\s*to|awarded\s*to|presented\s*to|certified\s*that)\s+([A-Z][A-Za-z .\'`-]{2,50})',
        r'(?:recipient|learner|participant)\s*[:\-]\s*([A-Z][A-Za-z .\'`-]{2,50})',
    ]
    for pat in patterns_name:
        m = re.search(pat, text, re.I)
        if m:
            fields['holder_name'] = m.group(1).strip()
            break

    patterns_cred = [
        r'course\s*(?:name|title)?\s*[:\-]\s*([^\n\r]{5,100})',
        r'(?:certification|certificate)\s+(?:in|of|for)\s+([^\n\r]{5,80})',
        r'successfully\s+completed\s+(?:the\s+)?(?:course\s+)?["\']?([A-Z][^\n\r"\']{5,80})',
    ]
    for pat in patterns_cred:
        m = re.search(pat, text, re.I)
        if m:
            fields['credential_name'] = m.group(1).strip()
            break

    m3 = re.search(r'\b(elite\s*\+\s*gold|elite\s*\+\s*silver|elite|gold|silver|completed)\b',
                   text, re.I)
    if m3:
        fields['level'] = m3.group(1).lower().replace(' ', '')

    return fields


def _find_cert_pdf_link(soup: BeautifulSoup, base_url: str) -> str | None:
    """
    On many issuer verification pages (e.g. NPTEL), there is an 'Open' or
    'View Certificate' button that links to the actual certificate PDF.
    Find and return that URL so we can fetch + OCR it.
    """
    from urllib.parse import urljoin

    OPEN_KEYWORDS = {'open', 'view certificate', 'view cert', 'download',
                     'get certificate', 'certificate', 'view'}

    # 1 — <a> tags whose visible text matches an open keyword
    for a in soup.find_all('a', href=True):
        link_text = a.get_text(strip=True).lower()
        href      = a['href'].strip()
        if any(kw in link_text for kw in OPEN_KEYWORDS) and href:
            return href if href.startswith('http') else urljoin(base_url, href)

    # 2 — Any <a> whose href ends in .pdf or contains 'certificate'/'ecertificate'
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        low  = href.lower()
        if ('.pdf' in low or 'ecertificate' in low or 'certificate' in low) and href:
            return href if href.startswith('http') else urljoin(base_url, href)

    # 3 — onclick / window.open("url") patterns on buttons
    for el in soup.find_all(True):
        onclick = el.get('onclick', '')
        if onclick:
            m = re.search(r'window\.open\s*\(\s*["\']([^"\']+)["\']', onclick, re.I)
            if m:
                href = m.group(1)
                return href if href.startswith('http') else urljoin(base_url, href)

    # 4 — <iframe> / <embed> src that is a PDF
    for tag in soup.find_all(['iframe', 'embed', 'object']):
        src = tag.get('src', '') or tag.get('data', '')
        if src and '.pdf' in src.lower():
            return src if src.startswith('http') else urljoin(base_url, src)

    return None


def _extract_html_fields(final_url: str, text: str) -> dict:
    soup   = BeautifulSoup(text, 'lxml')
    domain = urlparse(final_url).netloc.lower()

    # ── Per-issuer handlers (use their own verification page format) ──
    if 'credly.com' in domain or 'youracclaim.com' in domain:
        return _extract_credly(soup)

    if 'learn.microsoft.com' in domain or 'microsoft.com' in domain:
        return _extract_microsoft(soup)

    # ── NPTEL only: verification page has an "Open" button that
    #    leads to the actual certificate PDF — fetch + OCR that PDF ──
    if 'nptel.ac.in' in domain or 'archive.nptel.ac.in' in domain or 'swayam.gov.in' in domain:
        pdf_url = _find_cert_pdf_link(soup, final_url)
        if pdf_url:
            pdf_safety = check_domain_safety(pdf_url)
            if pdf_safety['safe']:
                pdf_fetch = _fetch_page(pdf_url)
                if pdf_fetch.get('ok'):
                    ct = pdf_fetch.get('content_type', '')
                    if any(t in ct for t in ('pdf', 'image', 'jpeg', 'png', 'webp')):
                        fields = _extract_from_binary(pdf_fetch['raw_bytes'], ct)
                        if fields.get('holder_name'):
                            fields['_pdf_url'] = pdf_url
                            return fields
        # Fallback: scrape the NPTEL HTML page text directly
        visible = soup.get_text(' ', strip=True)
        return _extract_from_html_text(visible)

    # ── All other issuers: scrape the HTML verification page ──────────
    visible = soup.get_text(' ', strip=True)
    return _extract_from_html_text(visible)


# ── Field extraction — PDF / image via OCR ────────────────────────────────────

def _extract_from_binary(raw_bytes: bytes, content_type: str) -> dict:
    """
    If the verification URL serves a PDF or image (like NPTEL does),
    download it, OCR it, and extract fields from the text.
    """
    if 'pdf' in content_type:
        ext = '.pdf'
    elif 'png' in content_type:
        ext = '.png'
    elif 'jpeg' in content_type or 'jpg' in content_type:
        ext = '.jpg'
    elif 'webp' in content_type:
        ext = '.webp'
    else:
        # Try PDF first (most cert verification URLs return PDF)
        ext = '.pdf'

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(raw_bytes)
            tmp_path = f.name

        # Reuse existing OCR pipeline
        from .ocr_reader import extract_text
        ocr_data = extract_text(tmp_path)
        raw_text = ocr_data.get('raw_text', '')

        fields = _extract_from_html_text(raw_text)

        # If the context-based extraction missed the name, try name_candidates
        if not fields.get('holder_name') and ocr_data.get('name_candidates'):
            fields['holder_name'] = ocr_data['name_candidates'][0]

        fields['_source'] = 'ocr'
        return fields

    except Exception as e:
        return {'_error': str(e)[:200]}
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# ── Main verifier ─────────────────────────────────────────────────────────────

def verify_url(url: str, expected_holder: str, expected_credential: str) -> dict:
    result = {
        'present': True,
        'url': url,
        'domain_safe': False,
        'domain': '',
        'fetched': False,
        'content_type': '',
        'fields_matched': False,
        'page_holder': None,
        'page_credential': None,
        'mismatches': [],
        'reason': '',
        'status': 'FAILED',
    }

    # 1 — Domain safety check before fetching
    safety = check_domain_safety(url)
    result['domain_safe'] = safety['safe']
    result['domain']      = safety['domain']
    if not safety['safe']:
        result['reason'] = safety['reason']
        return result

    # 2 — Fetch
    fetch = _fetch_page(url)
    if not fetch.get('ok'):
        result['reason'] = fetch['reason']
        return result

    result['fetched']      = True
    result['content_type'] = fetch['content_type']
    final_url              = fetch['final_url']

    # Verify redirect is still safe
    final_safety = check_domain_safety(final_url)
    if not final_safety['safe']:
        result['reason'] = (
            f'After redirect, final URL lands on "{final_safety["domain"]}" '
            'which is not an approved domain.'
        )
        return result

    # 3 — Extract fields
    ct     = fetch['content_type']
    f_domain = urlparse(final_url).netloc.lower()
    is_nptel = any(d in f_domain for d in ('nptel.ac.in', 'swayam.gov.in'))

    if 'html' in ct:
        # All issuers: scrape the HTML page
        # (NPTEL handler inside will follow the "Open" button to the PDF)
        fields = _extract_html_fields(final_url, fetch['text'])
    elif any(t in ct for t in ('pdf', 'image', 'jpeg', 'jpg', 'png', 'webp')):
        if is_nptel:
            # NPTEL QR sometimes directly serves the certificate PDF
            fields = _extract_from_binary(fetch['raw_bytes'], ct)
        else:
            # Other issuers should serve HTML verification pages, not raw PDFs.
            # If we get a PDF anyway, OCR it as a fallback.
            fields = _extract_from_binary(fetch['raw_bytes'], ct)
    else:
        fields = _extract_html_fields(final_url, fetch.get('text', ''))

    if fields.get('_error'):
        result['reason'] = f'Could not read verification document: {fields["_error"]}'
        result['status'] = 'FAILED'
        return result

    result['page_holder']     = fields.get('holder_name')
    result['page_credential'] = fields.get('credential_name')

    # 4 — Compare
    mismatches = []

    page_holder = fields.get('holder_name', '')
    if page_holder:
        if normalize(page_holder) != normalize(expected_holder):
            mismatches.append(
                f"Name on verification page: '{page_holder}' | "
                f"Expected: '{expected_holder}'"
            )
    else:
        mismatches.append(
            'Could not extract holder name from the verification page/document.'
        )

    page_cred = fields.get('credential_name', '')
    if page_cred:
        if not _credentials_overlap(page_cred, expected_credential):
            mismatches.append(
                f"Credential on verification page: '{page_cred}' | "
                f"Expected: '{expected_credential}'"
            )
    else:
        mismatches.append(
            'Could not extract credential name from the verification page/document.'
        )

    result['mismatches'] = mismatches

    # Record the PDF URL that was followed (if any), for the mentor report
    if fields.get('_pdf_url'):
        result['pdf_url'] = fields['_pdf_url']

    if not mismatches:
        result['fields_matched'] = True
        result['status'] = 'PASSED'
        extra = ''
        if fields.get('_pdf_url'):
            extra = f' (certificate PDF fetched from {fields["_pdf_url"]} and verified via OCR)'
        elif fields.get('_source') == 'ocr':
            extra = ' (verified via OCR on official document)'
        result['reason'] = f'All fields verified against the official page{extra}.'
    else:
        result['status'] = 'FAILED'
        result['reason'] = ' | '.join(mismatches)

    return result


def _credentials_overlap(page_cred: str, expected: str) -> bool:
    stop = {'certified', 'certification', 'associate', 'professional',
            'foundation', 'advanced', 'the', 'of', 'and', 'in', 'for',
            'nptel', 'introduction', 'to', 'course'}
    words_page = {w for w in normalize(page_cred).split() if w not in stop and len(w) > 2}
    words_exp  = {w for w in normalize(expected).split()  if w not in stop and len(w) > 2}
    return bool(words_page & words_exp)
