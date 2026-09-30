import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const MonthlyCodingReview = () => {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Mentor Direct Assignment Form State
  const [assignData, setAssignData] = useState({
    studentId: '',
    semester: 1,
    month: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()),
    year: new Date().getFullYear(),
    percentage: '',
    problemsSolved: '',
    totalProblems: '',
    platform: 'Department Assessment (Skillrack/HackerRank)',
  });
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    loadPendingEvidence();
  }, []);

  const loadPendingEvidence = async () => {
    try {
      setLoading(true);
      const result = await mentorAPI.getPendingMonthlyCoding();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending monthly coding evidence:', error);
      setMessage({ text: 'Failed to load pending evidence', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getTierFromPercentage = (pct) => {
    if (pct >= 80) return { tier: 'Tier 4: ≥80% (20 Marks)', marks: 20 };
    if (pct >= 70) return { tier: 'Tier 3: ≥70% (15 Marks)', marks: 15 };
    if (pct >= 60) return { tier: 'Tier 2: ≥60% (10 Marks)', marks: 10 };
    if (pct >= 50) return { tier: 'Tier 1: ≥50% (5 Marks)', marks: 5 };
    return { tier: 'Below Tier 1 (<50%)', marks: 0 };
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignData.studentId.trim()) {
      setMessage({ text: 'Please enter a student roll number', type: 'error' });
      return;
    }

    try {
      setAssignLoading(true);
      const res = await mentorAPI.assignMonthlyCodingScore({
        student_id: assignData.studentId.trim(),
        semester: parseInt(assignData.semester),
        month: assignData.month,
        year: parseInt(assignData.year),
        percentage: parseFloat(assignData.percentage),
        problems_solved: parseInt(assignData.problemsSolved) || 0,
        total_problems: parseInt(assignData.totalProblems) || 0,
        platform: assignData.platform,
      });

      if (res.success) {
        setMessage({
          text: `✅ ${res.message || 'Score assigned and verified successfully!'}`,
          type: 'success',
        });
        setAssignData({
          studentId: '',
          semester: 1,
          month: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date()),
          year: new Date().getFullYear(),
          percentage: '',
          problemsSolved: '',
          totalProblems: '',
          platform: 'Department Assessment (Skillrack/HackerRank)',
        });
        await loadPendingEvidence();
      } else {
        setMessage({
          text: res.message || res.error || 'Failed to record assessment score',
          type: 'error',
        });
      }
    } catch (err) {
      setMessage({ text: err.message || 'Network error recording assessment', type: 'error' });
    } finally {
      setAssignLoading(false);
    }
  };

  const handleVerify = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyMonthlyCoding(
        id,
        action,
        action === 'REJECTED' ? rejectionReason : null
      );

      setMessage({
        text: `Assessment ${action.toLowerCase()} successfully!`,
        type: 'success',
      });

      setSelectedEvidence(null);
      setRejectionReason('');
      await loadPendingEvidence();
    } catch (error) {
      console.error('Error verifying evidence:', error);
      setMessage({
        text: error.message || 'Failed to verify assessment',
        type: 'error',
      });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="review-queue-page">
      <Header />
      <div className="review-queue-container">
        <div className="page-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate('/mentor')}>
              ← Back to Mentor Dashboard
            </button>
            <h1>📅 Monthly Coding Assessment Management</h1>
            <p>Directly record test scores for students and evaluate monthly coding track</p>
          </div>
          <div className="header-right">
            <span className="pending-count-badge">
              {evidence.length} Pending Review
            </span>
          </div>
        </div>

        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Mentor Direct Assessment Assignment Form */}
        <div className="form-card" style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '28px',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            ✍️ Record & Assign Student Test Score
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
            Enter the student's roll number and monthly test score. The assessment will be recorded and their cumulative marks (out of 20) will update automatically.
          </p>

          <form onSubmit={handleAssignSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Student Roll Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 24CS422"
                  value={assignData.studentId}
                  onChange={(e) => setAssignData({ ...assignData, studentId: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Assessment Month *
                </label>
                <select
                  value={assignData.month}
                  onChange={(e) => setAssignData({ ...assignData, month: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                  }}
                  required
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Year *
                </label>
                <input
                  type="number"
                  value={assignData.year}
                  onChange={(e) => setAssignData({ ...assignData, year: e.target.value })}
                  min="2020"
                  max="2030"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Score Percentage (0-100) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 85.0"
                  value={assignData.percentage}
                  onChange={(e) => setAssignData({ ...assignData, percentage: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: '#059669',
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Semester
                </label>
                <select
                  value={assignData.semester}
                  onChange={(e) => setAssignData({ ...assignData, semester: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Problems Solved / Total
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="Solved"
                    value={assignData.problemsSolved}
                    onChange={(e) => setAssignData({ ...assignData, problemsSolved: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                    }}
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Total"
                    value={assignData.totalProblems}
                    onChange={(e) => setAssignData({ ...assignData, totalProblems: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.92rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Platform / Assessment Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Skillrack Monthly Contest / HackerRank Test"
                  value={assignData.platform}
                  onChange={(e) => setAssignData({ ...assignData, platform: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={assignLoading}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
              }}
            >
              {assignLoading ? 'Saving...' : '🚀 Record & Assign Score'}
            </button>
          </form>
        </div>

        {/* Pending Submissions Queue (if any) */}
        {loading ? (
          <div className="loading-state">Loading pending assessments...</div>
        ) : evidence.length > 0 && (
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
              Pending Student Submissions ({evidence.length})
            </h2>
            <div className="evidence-grid">
              {evidence.map((item) => {
                const { tier } = getTierFromPercentage(parseFloat(item.percentage) || 0);
                return (
                  <div key={item.id} className="evidence-card">
                    <div className="card-header">
                      <div className="student-info">
                        <h3>{item.student_name || 'Student'}</h3>
                        <span className="student-roll">{item.student_id}</span>
                        <span className="dept-tag">{item.department || 'Department'}</span>
                      </div>
                      <div className="tier-badge-container">
                        <span className="tier-marks-badge">
                          {item.percentage}% Score
                        </span>
                      </div>
                    </div>

                    <div className="card-body">
                      <div className="detail-row">
                        <span className="label">Assessment Period:</span>
                        <span className="value font-medium" style={{ color: '#0284c7' }}>
                          Sem {item.semester} — {item.month} {item.year}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Score Percentage:</span>
                        <span className="value font-medium" style={{ color: '#059669', fontSize: '1.1rem' }}>
                          {item.percentage}%
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Assessment Tier:</span>
                        <span className="value tier-highlight">
                          {tier}
                        </span>
                      </div>
                      {item.problems_solved !== null && item.total_problems !== null && (
                        <div className="detail-row">
                          <span className="label">Problems Solved:</span>
                          <span className="value">
                            {item.problems_solved} / {item.total_problems}
                          </span>
                        </div>
                      )}
                      {item.platform && (
                        <div className="detail-row">
                          <span className="label">Platform:</span>
                          <span className="value">{item.platform}</span>
                        </div>
                      )}

                      {selectedEvidence === item.id && (
                        <div className="rejection-form">
                          <textarea
                            placeholder="Please provide reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows="2"
                          />
                        </div>
                      )}
                    </div>

                    <div className="card-actions">
                      {selectedEvidence === item.id ? (
                        <>
                          <button
                            className="confirm-reject-btn"
                            disabled={processing === item.id}
                            onClick={() => handleVerify(item.id, 'REJECTED')}
                          >
                            Confirm Rejection
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={() => {
                              setSelectedEvidence(null);
                              setRejectionReason('');
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="approve-btn"
                            disabled={processing === item.id}
                            onClick={() => handleVerify(item.id, 'VERIFIED')}
                          >
                            {processing === item.id ? 'Processing...' : '✓ Approve & Update Marks'}
                          </button>
                          <button
                            className="reject-btn"
                            disabled={processing === item.id}
                            onClick={() => setSelectedEvidence(item.id)}
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyCodingReview;
