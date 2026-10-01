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

const ROUND_MARKS = {
  'VALID_COMPLETION': 2,
  'PRELIM': 4,
  'SECOND_ROUND': 6,
  'REGIONAL_FINALIST': 10,
  'NATIONAL_FINALIST': 15,
  'INTERNATIONAL_WINNER': 20,
};

const CompetitionReview = () => {
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
      const result = await mentorAPI.getPendingCompetition();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending competition evidence:', error);
      setMessage({ text: 'Failed to load pending evidence', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyCompetition(
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
            <h1>🏆 Competition Achievement Review</h1>
            <p>Review and verify competition submissions from your department students</p>
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
            <p>No pending competition achievements require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const computedMarks = ROUND_MARKS[item.round_cleared] || item.stage_marks || 0;
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
                        +{computedMarks} Marks
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="detail-row">
                      <span className="label">Event Name:</span>
                      <span className="value font-medium">{item.event_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Round Cleared:</span>
                      <span className="value tier-highlight">
                        {item.round_cleared} ({computedMarks} Marks)
                      </span>
                    </div>
                    {item.competition_type && (
                      <div className="detail-row">
                        <span className="label">Competition Type:</span>
                        <span className="value">{item.competition_type}</span>
                      </div>
                    )}
                    {item.organizer && (
                      <div className="detail-row">
                        <span className="label">Organizer:</span>
                        <span className="value">{item.organizer}</span>
                      </div>
                    )}
                    {item.event_date && (
                      <div className="detail-row">
                        <span className="label">Event Date:</span>
                        <span className="value">{new Date(item.event_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Submitted On:</span>
                      <span className="value">{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>

                    {(item.certificate_url || item.proof_url) && (
                      <div className="proof-container">
                        <a
                          href={getProofUrl(item.certificate_url || item.proof_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          📄 View Certificate / Proof Document ↗
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
                          {processing === item.id ? 'Processing...' : `✓ Approve (+${computedMarks}m)`}
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

export default CompetitionReview;
