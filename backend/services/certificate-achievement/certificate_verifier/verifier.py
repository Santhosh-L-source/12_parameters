"""
Main orchestrator — runs all 5 steps in order and builds the final report.
"""
from __future__ import annotations
import os
from . import ocr_reader, qr_reader, name_matcher, url_verifier, marks_calculator, matrix_lookup


class CertificateVerifier:

    def verify(self, image_path: str, student_name: str, running: dict | None = None) -> dict:
        """
        Run all verification steps on one certificate image.

        Parameters
        ----------
        image_path    : absolute path to the uploaded image / PDF page
        student_name  : student's registered name (from form)
        running       : accumulated marks dict from previous certs in the session

        Returns
        -------
        Full report dict (all step details + final status + marks)
        """
        if running is None:
            running = marks_calculator.fresh_running()

        report = {
            'student_name': student_name,
            'file': os.path.basename(image_path),
            'steps': {},
            'final_status': '',
            'marks_awarded': 0,
            'running_total': running.get('total', 0),
            'reason': [],
            'mentor_action': [],
        }

        # ── STEP 1: OCR ────────────────────────────────────────────────
        try:
            ocr_data = ocr_reader.extract_text(image_path)
        except Exception as e:
            return self._fail(report, 'OCR failed', str(e), running)

        report['steps']['ocr'] = {
            'lines_detected': len(ocr_data.get('lines', [])),
            'sample': ocr_data.get('lines', [])[:5],
        }

        # ── STEP 2: Matrix lookup ──────────────────────────────────────
        matrix_result = matrix_lookup.find_cert_in_matrix(ocr_data['raw_text'])
        report['steps']['matrix'] = {
            'found': matrix_result['found'],
            'matched_entry': matrix_result.get('matched_key'),
            'detected_level': matrix_result.get('detected_level'),
            'reason': matrix_result['reason'],
        }

        if not matrix_result['found']:
            report['reason'].append(matrix_result['reason'])
            report['mentor_action'].append(
                'Confirm whether this credential is approved and add it to the matrix if so.'
            )
            report['final_status'] = 'MENTOR REVIEW REQUIRED'
            return report

        entry         = matrix_result['entry']
        detected_level = matrix_result.get('detected_level')
        cert_name     = matrix_result['matched_key']

        # ── STEP 3: Name match ─────────────────────────────────────────
        name_result = name_matcher.find_best_name_in_ocr(ocr_data, student_name)
        report['steps']['name_match'] = {
            'found': name_result.get('found'),
            'cert_name': name_result.get('cert_name'),
            'registered_name': student_name,
            'match': name_result.get('match'),
            'reason': name_result.get('reason'),
        }

        if not name_result.get('found') or not name_result.get('match'):
            report['reason'].append(
                f"Name mismatch: '{name_result.get('cert_name')}' != '{student_name}'. "
                + name_result.get('reason', '')
            )
            report['mentor_action'].append(
                'Verify student identity — name on certificate does not match the registered name.'
            )
            report['final_status'] = 'MENTOR REVIEW REQUIRED'
            return report

        cert_holder = name_result['cert_name']

        # ── STEP 4: QR / URL verification ─────────────────────────────
        urls = qr_reader.decode_qr(image_path)
        # Also scan OCR text for printed URLs
        import re
        ocr_urls = re.findall(
            r'https?://[^\s\]\[<>"]{8,}',
            ocr_data.get('raw_text', '')
        )
        all_urls = list(dict.fromkeys(urls + ocr_urls))  # dedupe, preserve order

        if all_urls:
            url = all_urls[0]
            url_result = url_verifier.verify_url(url, cert_holder, cert_name)
            report['steps']['url_verification'] = url_result

            if url_result['status'] != 'PASSED':
                report['reason'].append(
                    f"URL verification failed: {url_result['reason']}"
                )
                report['mentor_action'].append(
                    f"Manually check verification URL: {url}  —  {url_result['reason']}"
                )
                report['final_status'] = 'MENTOR REVIEW REQUIRED'
                return report
        else:
            report['steps']['url_verification'] = {
                'present': False,
                'status': 'NOT PRESENT',
                'reason': 'No QR code or verification URL detected.',
            }

        # ── STEP 5: Marks ──────────────────────────────────────────────
        marks_result = marks_calculator.calculate(entry, detected_level, running)
        awarded   = marks_result['marks_awarded']
        new_running = marks_result['updated_running']

        report['steps']['marks'] = {
            'tier': entry.get('tier'),
            'base_marks': entry.get('marks') or 'level-based',
            'awarded': awarded,
            'reason': marks_result['reason'],
        }
        report['marks_awarded']  = awarded
        report['running_total']  = new_running['total']
        report['_updated_running'] = new_running  # for session use

        report['final_status'] = 'ELIGIBLE'
        report['reason'].append(marks_result['reason'])

        return report

    # ── helpers ────────────────────────────────────────────────────────

    def _fail(self, report, step, reason, running):
        report['final_status'] = 'MENTOR REVIEW REQUIRED'
        report['reason'].append(f'{step}: {reason}')
        report['mentor_action'].append(f'Technical failure at {step} — manual review required.')
        report['running_total'] = running.get('total', 0)
        return report
