const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SAFE_VERIFY_DOMAINS, BLOCKLISTED_DOMAINS, INELIGIBLE_PLATFORMS } = require('./matrix');
const { normalize } = require('./nameMatcher');

const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const REQUEST_TIMEOUT = 15000;
const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

function checkDomainSafety(url) {
  let parsed;
  try {
    parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
  } catch {
    return { safe: false, domain: '', reason: 'URL could not be parsed.' };
  }

  const domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const scheme = parsed.protocol.replace(':', '');

  if (scheme !== 'https') {
    return { safe: false, domain, reason: `URL does not use HTTPS (scheme: ${scheme}).` };
  }

  for (const bad of BLOCKLISTED_DOMAINS) {
    if (domain === bad || domain.endsWith('.' + bad)) {
      return { safe: false, domain, reason: `URL uses a blocklisted shortener/redirect domain: ${domain}.` };
    }
  }

  for (const platform of INELIGIBLE_PLATFORMS) {
    if (domain === platform || domain.endsWith('.' + platform)) {
      return { safe: false, domain,
        reason: `URL points to ${domain}, which is a course-completion platform, not an approved qualifying-exam issuer.` };
    }
  }

  let isSafe = false;
  for (const sd of SAFE_VERIFY_DOMAINS) {
    if (domain === sd || domain.endsWith('.' + sd)) { isSafe = true; break; }
  }

  if (isSafe) {
    return { safe: true, domain, reason: 'Domain is an approved issuer or verification partner.' };
  }

  return { safe: false, domain,
    reason: `Domain "${domain}" is not in the approved issuer / verification-partner list.` };
}

async function fetchPage(url) {
  try {
    const resp = await axios.get(url, {
      headers: SCRAPE_HEADERS,
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 5,
      responseType: 'arraybuffer',
      maxContentLength: MAX_DOWNLOAD_BYTES,
    });

    const rawBytes = Buffer.from(resp.data);
    const contentType = (resp.headers['content-type'] || '').toLowerCase();
    const finalUrl = resp.request?.res?.responseUrl || url;

    return {
      ok: true, final_url: finalUrl, content_type: contentType, raw_bytes: rawBytes,
      text: contentType.includes('html') ? rawBytes.toString('utf-8') : '',
    };
  } catch (err) {
    if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || err.message.includes('SSL')) {
      return { ok: false, reason: 'SSL certificate error on the verification page.' };
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return { ok: false, reason: 'Could not connect to the verification URL.' };
    }
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      return { ok: false, reason: 'Verification page timed out.' };
    }
    return { ok: false, reason: `Network error: ${String(err.message).slice(0, 120)}` };
  }
}

function extractCredly($) {
  const fields = {};
  $('meta').each(function () {
    const prop = $(this).attr('property') || $(this).attr('name') || '';
    const content = $(this).attr('content') || '';
    if (prop.includes('title')) fields.credential_name = content;
    if ((prop.includes('description')) && !fields.holder_name) {
      const m = content.match(/issued to ([A-Za-z ]+)/i);
      if (m) fields.holder_name = m[1].trim();
    }
  });
  const nameTag = $('.cr-badges-recipient-name, [data-cy="full-name"]');
  if (nameTag.length) fields.holder_name = nameTag.text().trim();
  const certTag = $('.cr-badges-full-badge__title, [data-cy="badge-title"]');
  if (certTag.length) fields.credential_name = certTag.text().trim();
  return fields;
}

function extractMicrosoft($) {
  const fields = {};
  const nameTag = $('[data-bi-cn="learner_name"], .learner-name, h2');
  if (nameTag.length) fields.holder_name = nameTag.first().text().trim();
  const certTag = $('.certification-title, h1');
  if (certTag.length) fields.credential_name = certTag.first().text().trim();
  return fields;
}

function extractFromHtmlText(text) {
  const fields = {};
  const namePatterns = [
    /(?:student\s*)?name\s*[:\-]\s*([A-Z][A-Za-z .'\`-]{2,50})/i,
    /(?:issued\s*to|awarded\s*to|presented\s*to|certified\s*that)\s+([A-Z][A-Za-z .'\`-]{2,50})/i,
    /(?:recipient|learner|participant)\s*[:\-]\s*([A-Z][A-Za-z .'\`-]{2,50})/i,
  ];
  for (const pat of namePatterns) {
    const m = text.match(pat);
    if (m) { fields.holder_name = m[1].trim(); break; }
  }

  const credPatterns = [
    /course\s*(?:name|title)?\s*[:\-]\s*([^\n\r]{5,100})/i,
    /(?:certification|certificate)\s+(?:in|of|for)\s+([^\n\r]{5,80})/i,
    /successfully\s+completed\s+(?:the\s+)?(?:course\s+)?["']?([A-Z][^\n\r"']{5,80})/i,
  ];
  for (const pat of credPatterns) {
    const m = text.match(pat);
    if (m) { fields.credential_name = m[1].trim(); break; }
  }

  const m3 = text.match(/\b(elite\s*\+\s*gold|elite\s*\+\s*silver|elite|gold|silver|completed)\b/i);
  if (m3) fields.level = m3[1].toLowerCase().replace(/ /g, '');

  return fields;
}

function findCertPdfLink($, baseUrl) {
  const OPEN_KEYWORDS = ['open', 'view certificate', 'view cert', 'download',
    'get certificate', 'certificate', 'view'];

  let found = null;
  $('a[href]').each(function () {
    if (found) return;
    const linkText = $(this).text().trim().toLowerCase();
    const href = $(this).attr('href').trim();
    if (OPEN_KEYWORDS.some(kw => linkText.includes(kw)) && href) {
      found = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    }
  });
  if (found) return found;

  $('a[href]').each(function () {
    if (found) return;
    const href = $(this).attr('href').trim();
    const low = href.toLowerCase();
    if (('.pdf' in low || low.includes('ecertificate') || low.includes('certificate')) && href) {
      found = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    }
  });
  if (found) return found;

  $('[onclick]').each(function () {
    if (found) return;
    const onclick = $(this).attr('onclick') || '';
    const m = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
    if (m) {
      found = m[1].startsWith('http') ? m[1] : new URL(m[1], baseUrl).href;
    }
  });
  if (found) return found;

  $('iframe, embed, object').each(function () {
    if (found) return;
    const src = $(this).attr('src') || $(this).attr('data') || '';
    if (src && src.toLowerCase().includes('.pdf')) {
      found = src.startsWith('http') ? src : new URL(src, baseUrl).href;
    }
  });

  return found;
}

async function extractFromBinary(rawBytes, contentType) {
  const ext = contentType.includes('pdf') ? '.pdf'
    : contentType.includes('png') ? '.png'
    : contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg'
    : contentType.includes('webp') ? '.webp' : '.pdf';

  const tmpPath = path.join(os.tmpdir(), `certverify_${Date.now()}${ext}`);
  try {
    fs.writeFileSync(tmpPath, rawBytes);
    const { extractText } = require('./ocrReader');
    const ocrData = await extractText(tmpPath);
    const fields = extractFromHtmlText(ocrData.raw_text);
    if (!fields.holder_name && ocrData.name_candidates && ocrData.name_candidates.length) {
      fields.holder_name = ocrData.name_candidates[0];
    }
    fields._source = 'ocr';
    return fields;
  } catch (err) {
    return { _error: String(err.message).slice(0, 200) };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ok */ }
  }
}

function extractHtmlFields(finalUrl, text) {
  const $ = cheerio.load(text);
  const domain = new URL(finalUrl).hostname.toLowerCase();

  if (domain.includes('credly.com') || domain.includes('youracclaim.com')) {
    return extractCredly($);
  }
  if (domain.includes('learn.microsoft.com') || domain.includes('microsoft.com')) {
    return extractMicrosoft($);
  }

  if (domain.includes('nptel.ac.in') || domain.includes('archive.nptel.ac.in') || domain.includes('swayam.gov.in')) {
    const pdfUrl = findCertPdfLink($, finalUrl);
    if (pdfUrl) {
      return { _needs_pdf_fetch: true, _pdf_url: pdfUrl };
    }
    const visible = $.text().replace(/\s+/g, ' ').trim();
    return extractFromHtmlText(visible);
  }

  const visible = $.text().replace(/\s+/g, ' ').trim();
  return extractFromHtmlText(visible);
}

function credentialsOverlap(pageCred, expected) {
  const stop = new Set(['certified', 'certification', 'associate', 'professional',
    'foundation', 'advanced', 'the', 'of', 'and', 'in', 'for',
    'nptel', 'introduction', 'to', 'course']);
  const wordsPage = new Set(normalize(pageCred).split(' ').filter(w => !stop.has(w) && w.length > 2));
  const wordsExp = new Set(normalize(expected).split(' ').filter(w => !stop.has(w) && w.length > 2));
  for (const w of wordsPage) {
    if (wordsExp.has(w)) return true;
  }
  return false;
}

async function verifyUrl(url, expectedHolder, expectedCredential) {
  const result = {
    present: true, url, domain_safe: false, domain: '', fetched: false,
    content_type: '', fields_matched: false, page_holder: null,
    page_credential: null, mismatches: [], reason: '', status: 'FAILED',
  };

  const safety = checkDomainSafety(url);
  result.domain_safe = safety.safe;
  result.domain = safety.domain;
  if (!safety.safe) { result.reason = safety.reason; return result; }

  const fetch = await fetchPage(url);
  if (!fetch.ok) { result.reason = fetch.reason; return result; }

  result.fetched = true;
  result.content_type = fetch.content_type;
  const finalUrl = fetch.final_url;

  const finalSafety = checkDomainSafety(finalUrl);
  if (!finalSafety.safe) {
    result.reason = `After redirect, final URL lands on "${finalSafety.domain}" which is not an approved domain.`;
    return result;
  }

  const ct = fetch.content_type;
  const fDomain = new URL(finalUrl).hostname.toLowerCase();
  const isNptel = ['nptel.ac.in', 'swayam.gov.in'].some(d => fDomain.includes(d));
  let fields;

  if (ct.includes('html')) {
    fields = extractHtmlFields(finalUrl, fetch.text);
    if (fields._needs_pdf_fetch) {
      const pdfUrl = fields._pdf_url;
      const pdfSafety = checkDomainSafety(pdfUrl);
      if (pdfSafety.safe) {
        const pdfFetch = await fetchPage(pdfUrl);
        if (pdfFetch.ok) {
          const pct = pdfFetch.content_type;
          if (['pdf', 'image', 'jpeg', 'png', 'webp'].some(t => pct.includes(t))) {
            fields = await extractFromBinary(pdfFetch.raw_bytes, pct);
            if (fields.holder_name) fields._pdf_url = pdfUrl;
          }
        }
      }
      if (fields._needs_pdf_fetch) {
        const visible = cheerio.load(fetch.text).text().replace(/\s+/g, ' ').trim();
        fields = extractFromHtmlText(visible);
      }
    }
  } else if (['pdf', 'image', 'jpeg', 'png', 'webp'].some(t => ct.includes(t))) {
    fields = await extractFromBinary(fetch.raw_bytes, ct);
  } else {
    fields = extractHtmlFields(finalUrl, fetch.text || '');
  }

  if (fields._error) {
    result.reason = `Could not read verification document: ${fields._error}`;
    result.status = 'FAILED';
    return result;
  }

  result.page_holder = fields.holder_name || null;
  result.page_credential = fields.credential_name || null;

  const mismatches = [];
  const pageHolder = fields.holder_name || '';
  if (pageHolder) {
    if (normalize(pageHolder) !== normalize(expectedHolder)) {
      mismatches.push(`Name on verification page: '${pageHolder}' | Expected: '${expectedHolder}'`);
    }
  } else {
    mismatches.push('Could not extract holder name from the verification page/document.');
  }

  const pageCred = fields.credential_name || '';
  if (pageCred) {
    if (!credentialsOverlap(pageCred, expectedCredential)) {
      mismatches.push(`Credential on verification page: '${pageCred}' | Expected: '${expectedCredential}'`);
    }
  } else {
    mismatches.push('Could not extract credential name from the verification page/document.');
  }

  result.mismatches = mismatches;
  if (fields._pdf_url) result.pdf_url = fields._pdf_url;

  if (!mismatches.length) {
    result.fields_matched = true;
    result.status = 'PASSED';
    let extra = '';
    if (fields._pdf_url) extra = ` (certificate PDF fetched from ${fields._pdf_url} and verified via OCR)`;
    else if (fields._source === 'ocr') extra = ' (verified via OCR on official document)';
    result.reason = `All fields verified against the official page${extra}.`;
  } else {
    result.status = 'FAILED';
    result.reason = mismatches.join(' | ');
  }

  return result;
}

module.exports = { checkDomainSafety, verifyUrl };
