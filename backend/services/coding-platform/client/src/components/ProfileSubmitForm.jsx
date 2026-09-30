import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchSync } from '../api';

const PLATFORMS = [
  { value: 'LEETCODE',       label: 'LeetCode',      placeholder: 'https://leetcode.com/u/username' },
  { value: 'CODEFORCES',     label: 'Codeforces',     placeholder: 'https://codeforces.com/profile/username' },
  { value: 'ATCODER',        label: 'AtCoder',        placeholder: 'https://atcoder.jp/users/username' },
  { value: 'CODECHEF',       label: 'CodeChef',       placeholder: 'https://www.codechef.com/users/username' },
  { value: 'HACKERRANK',     label: 'HackerRank',     placeholder: 'https://www.hackerrank.com/profile/username' },
  { value: 'GEEKSFORGEEKS',  label: 'GeeksforGeeks',  placeholder: 'https://www.geeksforgeeks.org/user/username/ or /profile/username' },
  { value: 'SKILLRACK',      label: 'SkillRack',      placeholder: 'https://www.skillrack.com/faces/resume.xhtml?id=...&key=...' },
];

export default function ProfileSubmitForm({ onSubmitted }) {
  const [form, setForm] = useState({
    studentId: '',
    semester: '',
    platform: '',
    profileUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const selectedPlatform = PLATFORMS.find((p) => p.value === form.platform);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId || !form.semester || !form.platform || !form.profileUrl) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await fetchSync({
        studentId: form.studentId,
        semester: parseInt(form.semester, 10),
        platform: form.platform,
        profileUrl: form.profileUrl,
      });

      const ev = result.evidence;
      if (result.warning) {
        toast(result.warning, { icon: '⚠️', duration: 8000 });
        toast.success(`Fetched! Total: ${ev.totalProblemsSolved}, SQL: ${ev.sqlProblemsSolved}`);
      } else {
        toast.success(result.message || `Fetched! Total: ${ev.totalProblemsSolved}, SQL: ${ev.sqlProblemsSolved}`);
      }
      onSubmitted?.(result.evidence);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Submit Profile</h2>
          <p>Enter your coding platform profile URL to auto-fetch stats</p>
        </div>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Student ID</label>
              <input
                className="form-input"
                placeholder="e.g. STU001"
                value={form.studentId}
                onChange={(e) => update('studentId', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Semester</label>
              <select
                className="form-select"
                value={form.semester}
                onChange={(e) => update('semester', e.target.value)}
              >
                <option value="">Select semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Platform</label>
              <select
                className="form-select"
                value={form.platform}
                onChange={(e) => update('platform', e.target.value)}
              >
                <option value="">Select platform</option>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group full-width">
              <label className="form-label">Profile URL</label>
              <input
                className="form-input"
                type="url"
                placeholder={selectedPlatform?.placeholder || 'Paste your profile URL'}
                value={form.profileUrl}
                onChange={(e) => update('profileUrl', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="spinner" /> : <Send size={16} />}
              {loading ? 'Fetching...' : 'Submit & Fetch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
