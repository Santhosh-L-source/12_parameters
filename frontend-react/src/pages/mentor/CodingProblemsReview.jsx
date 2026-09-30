import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const TIERS = [
  { total: 1000, sql: 75, marks: 25, tier: 'Tier 5 (1000+ Total & 75+ SQL)' },
  { total: 750, sql: 60, marks: 20, tier: 'Tier 4 (750+ Total & 60+ SQL)' },
  { total: 550, sql: 45, marks: 15, tier: 'Tier 3 (550+ Total & 45+ SQL)' },
  { total: 350, sql: 30, marks: 10, tier: 'Tier 2 (350+ Total & 30+ SQL)' },
  { total: 200, sql: 20, marks: 5, tier: 'Tier 1 (200+ Total & 20+ SQL)' },
];

const CodingProblemsReview = () => {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadPendingEvidence();
  }, []);

  const loadPendingEvidence = async () => {
    try {
      setLoading(true);
      const result = await mentorAPI.getPendingCodingProblems();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending coding problems evidence:', error);
      setMessage({ text: 'Failed to load pending evidence', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getProfileTier = (item) => {
    for (const t of TIERS) {
      if ((item.total_solved || 0) >= t.total && (item.sql_solved || 0) >= t.sql) {
        return t;
      }
    }
    return { marks: 0, tier: 'Below Tier 1 Threshold' };
  };

  const handleVerify = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyCodingProblems(
        id,
        action,
        action === 'REJECTED' ? rejectionReason : null
      );

      setMessage({
        text: `Evidence ${action.toLowerCase()} successfully!`,
        type: 'success'
      });

      setSelectedEvidence(null);
      setRejectionReason('');
      await loadPendingEvidence();
    } catch (error) {
      console.error('Error verifying evidence:', error);
      setMessage({
        text: error.message || 'Failed to verify evidence',
        type: 'error'
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
            <h1>💻 Coding Problems Review</h1>
            <p>Review and verify student coding platform metrics and problem counts</p>
          </div>
          <div className="header-right">
            <span className="pending-count-badge">
              {evidence.length} Pending
            </span>
          </div>
        </div>

        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="loading-state">Loading pending submissions...</div>
        ) : evidence.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>All Caught Up!</h3>
            <p>No pending coding problems profiles require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const tierInfo = getProfileTier(item);
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
                        {item.platform}
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-row">
                      <span className="label">Platform Handle:</span>
                      <span className="value font-medium">{item.username}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Total Solved:</span>
                      <span className="value font-medium" style={{ color: '#38bdf8' }}>{item.total_solved} Problems</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">SQL Solved:</span>
                      <span className="value font-medium" style={{ color: '#a78bfa' }}>{item.sql_solved} Problems</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Submission Mode:</span>
                      <span className="value">{item.fetch_method || 'MANUAL'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Standalone Tier:</span>
                      <span className="value tier-highlight">{tierInfo.tier}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>

                    {item.profile_url && (
                      <div className="proof-container">
                        <a
                          href={item.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          🔗 View Public Coding Profile ↗
                        </a>
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
                          {processing === item.id ? 'Processing...' : `✓ Verify Profile`}
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
        )}
      </div>
    </div>
  );
};

export default CodingProblemsReview;
