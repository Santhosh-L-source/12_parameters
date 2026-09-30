import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const HundredDaysReview = () => {
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
      const result = await mentorAPI.getPendingHundredDays();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending evidence:', error);
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
      await mentorAPI.verifyHundredDays(
        id,
        action,
        action === 'REJECTED' ? rejectionReason : null
      );

      setMessage({
        text: `Evidence ${action.toLowerCase()} successfully!`,
        type: 'success'
      });

      // Clear selection and reload
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

  const getProgramLabel = (program) => {
    const labels = {
      'PEP': 'PEP (5 marks)',
      'HOPE_NON_ELITE': 'HOPE Non-Elite (10 marks)',
      'HOPE_ELITE': 'HOPE Elite (15 marks)',
      'NOT_SELECTED': 'Not Selected (0 marks)'
    };
    return labels[program] || program;
  };

  const getProgramMarks = (program) => {
    const marks = {
      'PEP': 5,
      'HOPE_NON_ELITE': 10,
      'HOPE_ELITE': 15,
      'NOT_SELECTED': 0
    };
    return marks[program] || 0;
  };

  if (loading) {
    return (
      <div className="review-queue">
        <Header />
        <div className="container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-queue">
      <Header />
      <div className="container">
        <div className="page-header">
          <button className="back-btn" onClick={() => navigate('/mentor')}>
            ← Back to Dashboard
          </button>
          <h1>100 Days Training - Review Queue</h1>
          <p className="subtitle">
            {evidence.length} pending {evidence.length === 1 ? 'submission' : 'submissions'}
          </p>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {evidence.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <h3>All Caught Up!</h3>
            <p>No pending evidence to review</p>
          </div>
        ) : (
          <div className="evidence-list">
            {evidence.map((item) => (
              <div key={item.id} className="evidence-item">
                <div className="evidence-header">
                  <div className="student-info">
                    <h3>{item.student_name}</h3>
                    <span className="student-id">{item.student_id}</span>
                    <span className="department">{item.department}</span>
                  </div>
                  <div className="submission-date">
                    Submitted: {new Date(item.submitted_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="evidence-details">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="label">Training Program:</span>
                      <span className="value highlight">
                        {getProgramLabel(item.training_program)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Marks if Verified:</span>
                      <span className="value marks">
                        {getProgramMarks(item.training_program)} / 15
                      </span>
                    </div>
                    {item.selection_year && (
                      <div className="detail-item">
                        <span className="label">Selection Year:</span>
                        <span className="value">{item.selection_year}</span>
                      </div>
                    )}
                    {item.selection_letter_url && (
                      <div className="detail-item full-width">
                        <span className="label">Selection Letter:</span>
                        <a
                          href={item.selection_letter_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                        >
                          View Document →
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {selectedEvidence === item.id ? (
                  <div className="verification-panel">
                    <div className="form-group">
                      <label htmlFor={`rejection-${item.id}`}>
                        Rejection Reason (required if rejecting):
                      </label>
                      <textarea
                        id={`rejection-${item.id}`}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why this evidence is being rejected..."
                        rows="3"
                      />
                    </div>
                    <div className="action-buttons">
                      <button
                        className="btn btn-verify"
                        onClick={() => handleVerify(item.id, 'VERIFIED')}
                        disabled={processing === item.id}
                      >
                        {processing === item.id ? 'Processing...' : '✓ Verify'}
                      </button>
                      <button
                        className="btn btn-reject"
                        onClick={() => handleVerify(item.id, 'REJECTED')}
                        disabled={processing === item.id || !rejectionReason.trim()}
                      >
                        {processing === item.id ? 'Processing...' : '✗ Reject'}
                      </button>
                      <button
                        className="btn btn-cancel"
                        onClick={() => {
                          setSelectedEvidence(null);
                          setRejectionReason('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="quick-actions">
                    <button
                      className="btn btn-review"
                      onClick={() => setSelectedEvidence(item.id)}
                    >
                      Review →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HundredDaysReview;
