import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const OpenSourceReview = () => {
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
      const result = await mentorAPI.getPendingOpenSource();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending open source evidence:', error);
      setMessage({ text: 'Failed to load pending evidence', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getStageInfo = (item) => {
    if (item.is_maintainer || item.programme_completed) {
      return { stage: 'Stage 6: Maintainer / Programme Completion', marks: 20 };
    }
    if (item.programme_selected) {
      return { stage: 'Stage 5: Programme Selection', marks: 17 };
    }
    const merged = item.prs_merged || 0;
    if (merged >= 5) return { stage: 'Stage 4: 5+ PRs Merged', marks: 15 };
    if (merged >= 3) return { stage: 'Stage 3: 3 PRs Merged', marks: 10 };
    if (merged >= 1) return { stage: 'Stage 2: 1 PR Merged', marks: 5 };
    const submitted = item.prs_submitted || 0;
    if (submitted >= 1) return { stage: 'Stage 1: 1 PR Submitted', marks: 3 };
    return { stage: 'No verified contribution', marks: 0 };
  };

  const handleVerify = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyOpenSource(
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
            <h1>🌐 Open Source Contribution Review</h1>
            <p>Review GitHub PRs, repository maintainer status, and open source programmes</p>
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
            <p>No pending open source contributions require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const { stage, marks } = getStageInfo(item);
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
                        +{marks} Marks
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-row">
                      <span className="label">Contribution:</span>
                      <span className="value font-medium">{item.repo_name || item.programme_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">GitHub Handle:</span>
                      <span className="value font-medium" style={{ color: '#38bdf8' }}>{item.github_username}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">PRs Status:</span>
                      <span className="value">
                        <strong>{item.prs_merged || 0}</strong> merged / <strong>{item.prs_submitted || 0}</strong> submitted
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Evaluated Stage:</span>
                      <span className="value tier-highlight">{stage}</span>
                    </div>
                    {item.is_maintainer && (
                      <div className="detail-row">
                        <span className="label">Special Role:</span>
                        <span className="value" style={{ color: '#fbbf24' }}>⭐ Repository Maintainer</span>
                      </div>
                    )}
                    {item.programme_selected && (
                      <div className="detail-row">
                        <span className="label">Programme Status:</span>
                        <span className="value" style={{ color: '#34d399' }}>Selected in {item.programme_name}</span>
                      </div>
                    )}
                    {item.remarks && (
                      <div className="detail-row">
                        <span className="label">Student Notes:</span>
                        <span className="value">{item.remarks}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>

                    <div className="proof-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {item.repo_url && (
                        <a
                          href={item.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          🔗 View Repository ↗
                        </a>
                      )}
                      {item.programme_url && (
                        <a
                          href={item.programme_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          🌐 View Programme URL ↗
                        </a>
                      )}
                    </div>

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
                          {processing === item.id ? 'Processing...' : `✓ Approve (+${marks}m)`}
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

export default OpenSourceReview;
