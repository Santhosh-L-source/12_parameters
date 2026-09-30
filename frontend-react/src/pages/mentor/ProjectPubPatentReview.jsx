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
  PROJECT: {
    'CONCEPT_DESIGN': 5,
    'WORKING_PROTOTYPE': 10,
    'DEPLOYED_PRODUCT': 15,
    'MONETIZED_OR_FUNDED': 20,
  },
  PUBLICATION: {
    'CONFERENCE_LOCAL': 5,
    'CONFERENCE_NATIONAL': 10,
    'JOURNAL_INDEXED': 15,
    'JOURNAL_HIGH_IMPACT': 20,
  },
  PATENT: {
    'FILED': 5,
    'PUBLISHED': 10,
    'GRANTED': 20,
  }
};

const ProjectPubPatentReview = () => {
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
      const result = await mentorAPI.getPendingProjectPubPatent();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending project/pub/patent evidence:', error);
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
      await mentorAPI.verifyProjectPubPatent(
        id,
        action,
        action === 'REJECTED' ? rejectionReason : null
      );

      setMessage({
        text: `Output ${action.toLowerCase()} successfully!`,
        type: 'success'
      });

      setSelectedEvidence(null);
      setRejectionReason('');
      await loadPendingEvidence();
    } catch (error) {
      console.error('Error verifying output:', error);
      setMessage({
        text: error.message || 'Failed to verify output',
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
            <h1>🔬 Project / Publication / Patent Review</h1>
            <p>Review projects, research papers, and patent filings across all 8 semesters</p>
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
          <div className="loading-state">Loading pending outputs...</div>
        ) : evidence.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>All Caught Up!</h3>
            <p>No pending projects, publications, or patents require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const typeMap = STAGE_MARKS[item.achievement_type] || {};
              const computedMarks = typeMap[item.achievement_stage] || item.stage_marks || 0;
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
                      <span className="label">Category:</span>
                      <span className="value font-medium" style={{ color: '#38bdf8' }}>
                        {item.achievement_type === 'PROJECT' ? '🚀 Project / Product' : item.achievement_type === 'PUBLICATION' ? '📄 Research Publication' : '💡 Patent / IP'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Output Title:</span>
                      <span className="value font-medium">{item.output_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Milestone Stage:</span>
                      <span className="value tier-highlight">
                        {item.achievement_stage} ({computedMarks} Marks)
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Semester:</span>
                      <span className="value">Semester {item.semester}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">{new Date(item.created_at || item.submitted_at || Date.now()).toLocaleDateString()}</span>
                    </div>

                    {item.proof_url && (
                      <div className="proof-container">
                        <a
                          href={getProofUrl(item.proof_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          📄 View Research Proof Document / Code ↗
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

export default ProjectPubPatentReview;
