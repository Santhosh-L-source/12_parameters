from __future__ import annotations
import os
import uuid
import json
import shutil
from functools import wraps
from flask import (Flask, render_template, request, jsonify,
                   session, redirect, url_for, flash, send_file, abort)
from werkzeug.utils import secure_filename
from config import Config, DEPARTMENTS, SEMESTERS
import database as db
from certificate_verifier import CertificateVerifier
from certificate_verifier.marks_calculator import fresh_running

app = Flask(__name__)
app.config.from_object(Config)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

CERT_STORE = os.path.join(os.path.dirname(__file__), 'certificates')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(CERT_STORE, exist_ok=True)
db.init_db()


# ── Helpers ────────────────────────────────────────────────────────────────────

def allowed_file(filename: str) -> bool:
    return ('.' in filename
            and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS'])


def mentor_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('mentor_logged_in'):
            return redirect(url_for('mentor_login'))
        return f(*args, **kwargs)
    return decorated


# ── Student routes ─────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html', departments=DEPARTMENTS, semesters=SEMESTERS)


@app.route('/verify', methods=['POST'])
def verify():
    student_name = request.form.get('student_name', '').strip()
    roll_number  = request.form.get('roll_number',  '').strip()
    semester     = request.form.get('semester',     '').strip()
    department   = request.form.get('department',   '').strip()
    email        = request.form.get('email',        '').strip()

    errors = {}
    if not student_name: errors['student_name'] = 'Required'
    if not roll_number:  errors['roll_number']  = 'Required'
    if not semester:     errors['semester']     = 'Required'
    if not department:   errors['department']   = 'Required'
    if errors:
        return jsonify({'error': 'Missing fields', 'fields': errors}), 400

    if 'certificate' not in request.files:
        return jsonify({'error': 'No certificate uploaded.'}), 400
    file = request.files['certificate']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected.'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'Unsupported file type. Use PNG, JPG, JPEG, WEBP or PDF.'}), 400

    ext       = file.filename.rsplit('.', 1)[1].lower()
    tmp_name  = f"{uuid.uuid4().hex}.{ext}"
    tmp_path  = os.path.join(app.config['UPLOAD_FOLDER'], tmp_name)
    file.save(tmp_path)

    sub_id    = uuid.uuid4().hex[:12]
    # Permanent copy — mentor will view this
    perm_name = f"{sub_id}.{ext}"
    perm_path = os.path.join(CERT_STORE, perm_name)
    shutil.copy2(tmp_path, perm_path)

    try:
        running_key = f'running_{roll_number}'
        raw     = session.get(running_key)
        running = raw if raw else fresh_running()
        running['seen'] = set(running.get('seen', []))

        verifier = CertificateVerifier()
        result   = verifier.verify(tmp_path, student_name, running)

        updated = result.pop('_updated_running', None)
        if updated:
            updated['seen'] = list(updated.get('seen', set()))
            session[running_key] = updated

        result['roll_number']    = roll_number
        result['semester']       = semester
        result['department']     = department
        result['email']          = email
        result['cert_filename']  = file.filename
        result['cert_saved_path'] = perm_path

        db.save_submission(sub_id, result)
        result['submission_id'] = sub_id

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': f'Verification error: {str(e)[:300]}'}), 500
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@app.route('/status/<sub_id>')
def submission_status(sub_id):
    sub = db.get_submission(sub_id)
    if not sub:
        return "Submission not found", 404
    sub['verification_json'] = json.loads(sub.get('verification_json') or '{}')
    sub['mentor_actions']    = json.loads(sub.get('mentor_actions') or '[]')
    sub['mentor_reasons']    = json.loads(sub.get('mentor_reasons') or '[]')
    return render_template('submission.html', sub=sub)


@app.route('/my-submissions', methods=['GET', 'POST'])
def my_submissions():
    subs, roll = [], ''
    if request.method == 'POST':
        roll = request.form.get('roll_number', '').strip()
        if roll:
            subs = db.get_student_submissions(roll)
    return render_template('my_submissions.html', subs=subs, roll=roll)


@app.route('/reset', methods=['POST'])
def reset():
    roll = request.json.get('roll_number', '') if request.is_json else ''
    if roll:
        session.pop(f'running_{roll}', None)
    return jsonify({'status': 'reset'})


# ── Mentor routes ──────────────────────────────────────────────────────────────

@app.route('/mentor/login', methods=['GET', 'POST'])
def mentor_login():
    if request.method == 'POST':
        if request.form.get('password', '') == app.config['MENTOR_PASSWORD']:
            session['mentor_logged_in'] = True
            return redirect(url_for('mentor_dashboard'))
        flash('Incorrect password.')
    return render_template('mentor_login.html')


@app.route('/mentor/logout')
def mentor_logout():
    session.pop('mentor_logged_in', None)
    return redirect(url_for('mentor_login'))


@app.route('/mentor')
@mentor_required
def mentor_dashboard():
    filter_by = request.args.get('filter', 'all')
    all_subs  = db.get_all_submissions()
    filters = {
        'pending':  lambda s: s['mentor_decision'] == 'PENDING',
        'eligible': lambda s: s['final_status'] == 'ELIGIBLE',
        'approved': lambda s: s['mentor_decision'] == 'APPROVED',
        'rejected': lambda s: s['mentor_decision'] == 'REJECTED',
    }
    subs = [s for s in all_subs if filters[filter_by](s)] if filter_by in filters else all_subs
    return render_template('mentor.html', subs=subs,
                           stats=db.get_stats(), filter_by=filter_by)


@app.route('/mentor/submission/<sub_id>')
@mentor_required
def mentor_submission(sub_id):
    sub = db.get_submission(sub_id)
    if not sub:
        return "Not found", 404
    sub['verification_json'] = json.loads(sub.get('verification_json') or '{}')
    sub['mentor_actions']    = json.loads(sub.get('mentor_actions') or '[]')
    sub['mentor_reasons']    = json.loads(sub.get('mentor_reasons') or '[]')
    sub['has_file'] = bool(sub.get('cert_saved_path') and
                           os.path.exists(sub['cert_saved_path']))
    return render_template('submission.html', sub=sub, mentor_view=True)


@app.route('/mentor/file/<sub_id>')
@mentor_required
def mentor_view_file(sub_id):
    """Serve the stored certificate file to the mentor."""
    sub = db.get_submission(sub_id)
    if not sub:
        abort(404)
    saved = sub.get('cert_saved_path', '')
    if not saved or not os.path.exists(saved):
        abort(404, description="Certificate file not found on server.")
    ext = os.path.splitext(saved)[1].lower()
    mime = 'application/pdf' if ext == '.pdf' else f'image/{ext.lstrip(".")}'
    # inline so the browser opens it directly
    return send_file(saved, mimetype=mime,
                     as_attachment=False,
                     download_name=sub.get('cert_filename', 'certificate' + ext))


@app.route('/mentor/review/<sub_id>', methods=['POST'])
@mentor_required
def mentor_review(sub_id):
    decision = request.form.get('decision', '').upper()
    comment  = request.form.get('comment', '').strip()
    if decision not in ('APPROVED', 'REJECTED'):
        flash('Invalid decision.')
        return redirect(url_for('mentor_submission', sub_id=sub_id))
    db.update_mentor_decision(sub_id, decision, comment)
    flash(f'Submission {sub_id} marked as {decision}.')
    return redirect(url_for('mentor_dashboard') + '?filter=pending')


@app.route('/api/certificate/marks/<roll_number>')
def get_marks(roll_number):
    try:
        subs = db.get_student_submissions(roll_number)
        total = sum(
            s.get('marks_awarded', 0)
            for s in subs
            if s.get('mentor_decision') == 'APPROVED'
        )
        return jsonify({
            'studentId': roll_number,
            'module': 'Certificate Achievement',
            'maxMarks': 20,
            'marks': min(total, 20),
            'evidenceCount': len([s for s in subs if s.get('mentor_decision') == 'APPROVED']),
        })
    except Exception:
        return jsonify({
            'studentId': roll_number,
            'module': 'Certificate Achievement',
            'maxMarks': 20,
            'marks': 0,
            'evidenceCount': 0,
        })


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'certificate-achievement'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3011))
    app.run(debug=True, port=port)
