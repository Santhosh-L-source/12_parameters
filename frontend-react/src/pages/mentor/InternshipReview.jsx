import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI, API_BASE_URL } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const getProofUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

const STAGE_MARKS = {
  RECRUITMENT: {
    'APPLIED': 2,
    'SHORTLISTED': 4,
    'INTERVIEWED': 6,
    'OFFERED': 10,
    'JOINED': 15,
    'COMPLETED': 20,
  },
  STARTUP: {
    'IDEATION': 3,
    'PROTOTYPE': 5,
    'REGISTERED': 8,
    'FUNDED_SEED': 10,
    'REVENUE': 15,
    'SCALED': 20,
  }
};

const InternshipReview = () => {
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
      const result = await mentorAPI.getPendingInternship();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending internship evidence:', error);
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
      await mentorAPI.verifyInternship(
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
            <h1>💼 Internship & Startup Review</h1>
            <p>Review and verify dual-track employment and entrepreneurship milestones</p>
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
            <p>No pending internship or startup milestones require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const trackMarks = STAGE_MARKS[item.track] || {};
              const computedMarks = trackMarks[item.achievement_stage] || item.stage_marks || 0;
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
                      <span className="label">Track:</span>
                      <span className="value font-medium" style={{ color: item.track === 'STARTUP' ? '#a78bfa' : '#38bdf8' }}>
                        {item.track === 'STARTUP' ? '🚀 Startup Track' : '🏢 Corporate Recruitment Track'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Company / Startup:</span>
                      <span className="value font-medium">{item.company_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Milestone Stage:</span>
                      <span className="value tier-highlight">
                        {item.achievement_stage} ({computedMarks} Marks)
                      </span>
                    </div>
                    {item.role && (
                      <div className="detail-row">
                        <span className="label">Role:</span>
                        <span className="value">{item.role}</span>
                      </div>
                    )}
                    {item.duration_months && (
                      <div className="detail-row">
                        <span className="label">Duration:</span>
                        <span className="value">{item.duration_months} Months</span>
                      </div>
                    )}
                    {(item.start_date || item.end_date) && (
                      <div className="detail-row">
                        <span className="label">Period:</span>
                        <span className="value">
                          {item.start_date ? new Date(item.start_date).toLocaleDateString() : ''} - {item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Ongoing'}
                        </span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>

                    <div className="proof-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {item.offer_letter_url && (
                        <a
                          href={getProofUrl(item.offer_letter_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          📄 View Offer Letter ↗
                        </a>
                      )}
                      {item.completion_certificate_url && (
                        <a
                          href={getProofUrl(item.completion_certificate_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          📜 View Completion Certificate ↗
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

export default InternshipReview;
