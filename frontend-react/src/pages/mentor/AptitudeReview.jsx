import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI, API_BASE_URL } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const getProofUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

const AptitudeReview = () => {
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
      const result = await mentorAPI.getPendingAptitude();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending aptitude evidence:', error);
      setMessage({ text: 'Failed to load pending evidence', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const calculateItemMarks = (item) => {
    if (item.evidence_category === 'APTITUDE') {
      const p = item.percentile;
      if (!item.test_completed) return { marks: 0, desc: 'Test not completed' };
      if (p >= 90) return { marks: 15, desc: '≥90th Percentile (Tier 5)' };
      if (p >= 80) return { marks: 12, desc: '≥80th Percentile (Tier 4)' };
      if (p >= 70) return { marks: 9, desc: '≥70th Percentile (Tier 3)' };
      if (p >= 60) return { marks: 6, desc: '≥60th Percentile (Tier 2)' };
      return { marks: 3, desc: 'Test Completed / Base Tier (Tier 1)' };
    } else {
      if (item.meets_central_threshold) return { marks: 5, desc: 'Meets Central Threshold (Tier 2)' };
      if (item.has_valid_scorecard) return { marks: 3, desc: 'Valid Scorecard (Tier 1)' };
      return { marks: 0, desc: 'No scorecard / threshold' };
    }
  };

  const handleVerify = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyAptitude(
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
            <h1>🧠 Aptitude & Communication Review</h1>
            <p>Review Aptitude percentiles (max 15) and Communication scorecards (max 5)</p>
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
            <p>No pending aptitude or communication assessments require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const { marks, desc } = calculateItemMarks(item);
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
                      <span className="label">Category:</span>
                      <span className="value font-medium" style={{ color: item.evidence_category === 'APTITUDE' ? '#38bdf8' : '#a78bfa' }}>
                        {item.evidence_category === 'APTITUDE' ? '📊 Aptitude Assessment (Max 15m)' : '🗣️ Communication Proficiency (Max 5m)'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Evaluated Tier:</span>
                      <span className="value tier-highlight">
                        {desc} (+{marks} Marks)
                      </span>
                    </div>
                    {item.evidence_category === 'APTITUDE' ? (
                      <>
                        <div className="detail-row">
                          <span className="label">Percentile Score:</span>
                          <span className="value font-medium">{item.percentile ? `${item.percentile}th Percentile` : 'Completed (No floor)'}</span>
                        </div>
                        {item.test_name && (
                          <div className="detail-row">
                            <span className="label">Test Name:</span>
                            <span className="value">{item.test_name}</span>
                          </div>
                        )}
                        {item.test_date && (
                          <div className="detail-row">
                            <span className="label">Test Date:</span>
                            <span className="value">{new Date(item.test_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="detail-row">
                          <span className="label">Valid Scorecard:</span>
                          <span className="value">{item.has_valid_scorecard ? '✓ Yes' : '✗ No'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Central Threshold:</span>
                          <span className="value">{item.meets_central_threshold ? '✓ Meets Central Threshold (5 Marks)' : '—'}</span>
                        </div>
                        {item.event_description && (
                          <div className="detail-row">
                            <span className="label">Event / Test:</span>
                            <span className="value">{item.event_description}</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>

                    {item.certificate_url && (
                      <div className="proof-container">
                        <a
                          href={getProofUrl(item.certificate_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          📄 View Test Scorecard / Certificate ↗
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

export default AptitudeReview;
