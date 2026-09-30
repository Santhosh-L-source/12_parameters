import { useState, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PlatformIcon from './PlatformIcon';
import StatusBadge from './StatusBadge';
import { getStudentEvidence, verifyEvidence } from '../api';

export default function MentorPanel() {
  const [studentId, setStudentId] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(null);

  const loadEvidence = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getStudentEvidence(id);
      setEvidence(data);
      if (data.length === 0) toast('No evidence found for this student');
    } catch (err) {
      toast.error(err.message);
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    loadEvidence(studentId.trim());
  }

  async function handleVerify(row, status) {
    if (!mentorId.trim()) {
      toast.error('Please enter your Mentor ID first');
      return;
    }
    setVerifying(row.id);
    try {
      await verifyEvidence(row.id, status, mentorId.trim());
      toast.success(`Evidence ${status === 'APPROVED' ? 'approved' : 'rejected'}`);
      loadEvidence(studentId.trim());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const pendingCount = evidence.filter((e) => e.status === 'PENDING').length;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} />
              Mentor Verification Panel
            </h2>
            <p>Review and verify student coding evidence</p>
          </div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Mentor ID</label>
              <input
                className="form-input"
                placeholder="e.g. MENTOR001"
                value={mentorId}
                onChange={(e) => setMentorId(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Student ID to Review</label>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="e.g. STU001"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
                <button className="btn btn-primary" type="submit">
                  <Search size={16} />
                  Load
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {evidence.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div>
              <h2>
                Evidence for {studentId}
              </h2>
              <p>
                {pendingCount > 0
                  ? `${pendingCount} record${pendingCount > 1 ? 's' : ''} awaiting verification`
                  : 'All records reviewed'}
              </p>
            </div>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div className="loading-row">
                <div className="spinner" />
                <p>Loading...</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Sem</th>
                    <th>Total Solved</th>
                    <th>SQL Solved</th>
                    <th>Status</th>
                    <th>Fetched</th>
                    <th>Profile</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <PlatformIcon platform={row.platform} />
                      </td>
                      <td>{row.semester}</td>
                      <td>
                        <span className={`num-highlight ${row.totalProblemsSolved === 0 ? 'num-zero' : ''}`}>
                          {row.totalProblemsSolved.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span className={`num-highlight ${row.sqlProblemsSolved === 0 ? 'num-zero' : ''}`}>
                          {row.sqlProblemsSolved.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {formatDate(row.fetchedAt)}
                      </td>
                      <td>
                        <a
                          href={row.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-icon"
                          title="Open profile to verify"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </td>
                      <td>
                        {row.status === 'PENDING' || row.status === 'FETCH_FAILED' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleVerify(row, 'APPROVED')}
                              disabled={verifying === row.id}
                            >
                              {verifying === row.id ? (
                                <Loader2 size={14} className="spinner" />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleVerify(row, 'REJECTED')}
                              disabled={verifying === row.id}
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {row.status === 'APPROVED' ? 'Verified' : 'Rejected'}
                            {row.mentorId && ` by ${row.mentorId}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
