import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const CpRatingReview = () => {
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
      const result = await mentorAPI.getPendingCPRating();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending CP rating evidence:', error);
      setMessage({ text: 'Failed to load pending evidence', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getRatingTier = (item) => {
    const r = item.current_rating || 0;
    if (item.platform === 'CODEFORCES') {
      if (r >= 1800) return { marks: 20, tier: 'Expert+ (20 Marks)' };
      if (r >= 1600) return { marks: 15, tier: 'Specialist (15 Marks)' };
      if (r >= 1400) return { marks: 10, tier: 'Pupil (10 Marks)' };
      if (r >= 1200) return { marks: 5, tier: 'Apprentice (5 Marks)' };
      return { marks: 0, tier: 'Unrated / Below 1200' };
    } else {
      if (r >= 2000) return { marks: 20, tier: 'Tier 4 (20 Marks)' };
      if (r >= 1800) return { marks: 15, tier: 'Tier 3 (15 Marks)' };
      if (r >= 1600) return { marks: 10, tier: 'Tier 2 (10 Marks)' };
      if (r >= 1400) return { marks: 5, tier: 'Tier 1 (5 Marks)' };
      return { marks: 0, tier: 'Below 1400' };
    }
  };

  const handleVerify = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyCPRating(
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
            <h1>🏆 Competitive Programming Rating Review</h1>
            <p>Review contest ratings and handles across Codeforces, CodeChef, and LeetCode Contest</p>
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
            <p>No pending CP rating submissions require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const tierInfo = getRatingTier(item);
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
                        +{tierInfo.marks} Marks
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-row">
                      <span className="label">Platform:</span>
                      <span className="value font-medium" style={{ color: '#38bdf8' }}>{item.platform}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Contest Handle:</span>
                      <span className="value font-medium">{item.username}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Current Rating:</span>
                      <span className="value font-medium" style={{ color: '#34d399', fontSize: '1.1rem' }}>
                        {item.current_rating}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Calculated Tier:</span>
                      <span className="value tier-highlight">{tierInfo.tier}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Fetch Method:</span>
                      <span className="value">{item.fetch_method || 'MANUAL'}</span>
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
                          🔗 View Public Rating Profile ↗
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
                          {processing === item.id ? 'Processing...' : `✓ Approve (+${tierInfo.marks}m)`}
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

export default CpRatingReview;
