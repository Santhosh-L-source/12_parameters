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

const ACADEMIC_MARKS = {
  'BASIC': 3,
  'INTERMEDIATE': 5,
  'ADVANCED': 10,
  'EXPERT': 15,
};

const INDUSTRY_MARKS = {
  'ASSOCIATE': 5,
  'PROFESSIONAL': 10,
  'EXPERT': 15,
};

const CertificateReview = () => {
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
      const result = await mentorAPI.getPendingCertificate();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending certificate evidence:', error);
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
      await mentorAPI.verifyCertificate(
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
            <h1>📜 Certificate Achievement Review</h1>
            <p>Review Academic and Industry certifications with foundation cap verification</p>
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
            <p>No pending certificate achievements require review right now.</p>
          </div>
        ) : (
          <div className="evidence-grid">
            {evidence.map((item) => {
              const marksMap = item.credential_category === 'ACADEMIC' ? ACADEMIC_MARKS : INDUSTRY_MARKS;
              const computedMarks = marksMap[item.tier_level] || item.tier_marks || 0;
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
                      <span className="label">Credential Name:</span>
                      <span className="value font-medium">{item.credential_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Category:</span>
                      <span className="value font-medium" style={{ color: item.credential_category === 'INDUSTRY' ? '#38bdf8' : '#a78bfa' }}>
                        {item.credential_category === 'INDUSTRY' ? '🏢 Industry Certification' : '🎓 Academic Course (NPTEL/Coursera)'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Tier Level:</span>
                      <span className="value tier-highlight">
                        {item.tier_level} ({computedMarks} Marks)
                      </span>
                    </div>
                    {item.issuing_organization && (
                      <div className="detail-row">
                        <span className="label">Issuer:</span>
                        <span className="value">{item.issuing_organization}</span>
                      </div>
                    )}
                    {item.credential_id && (
                      <div className="detail-row">
                        <span className="label">Credential ID:</span>
                        <span className="value">{item.credential_id}</span>
                      </div>
                    )}
                    {item.is_foundation_level && (
                      <div className="detail-row">
                        <span className="label">Level:</span>
                        <span className="value" style={{ color: '#fbbf24' }}>⚠️ Foundation Level (Subject to 10m Sub-Cap)</span>
                      </div>
                    )}
                    {(item.issue_date || item.expiry_date) && (
                      <div className="detail-row">
                        <span className="label">Issued:</span>
                        <span className="value">
                          {item.issue_date ? new Date(item.issue_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Submitted:</span>
                      <span className="value">{new Date(item.submitted_at).toLocaleDateString()}</span>
                    </div>

                    <div className="proof-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {item.certificate_url && (
                        <a
                          href={getProofUrl(item.certificate_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                        >
                          📄 View Certificate Document ↗
                        </a>
                      )}
                      {item.verify_url && (
                        <a
                          href={item.verify_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="proof-link"
                          style={{ borderColor: '#10b981', color: '#059669', background: '#ecfdf5' }}
                        >
                          🔗 Platform Verification Link (Credly/Coursera) ↗
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

export default CertificateReview;
