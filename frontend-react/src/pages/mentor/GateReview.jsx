import React, { useState, useEffect } from 'react';
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

const GateReview = () => {
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
      const result = await mentorAPI.getPendingGate();
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
      await mentorAPI.verifyGate(
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

  // Calculate core marks tier using same logic as backend
  const calculateCoreTier = (item) => {
    if (item.is_bonus_exam) {
      return { tier: 'N/A', marks: 0, reason: 'Bonus exam (no core tier)' };
    }

    const ev = {
      tests_completed: item.tests_completed || 0,
      full_length_tests: item.full_length_tests || 0,
      average_score_percent: item.average_score_percent || 0,
      diagnostic_completed: item.diagnostic_completed || false,
      official_appearance: item.official_appearance || false,
      qualified: item.qualified || false,
      gate_score: item.gate_score || null,
      branch_code: item.branch_code || null,
    };

    // Tier 6: Branch-calibrated GATE score (25 marks)
    // NOTE: We don't have branchThreshold in frontend, so this is provisional
    if (ev.gate_score && ev.branch_code) {
      return { tier: 'Tier 6 (provisional)', marks: 25, reason: `GATE score ${ev.gate_score} with branch ${ev.branch_code} - needs threshold check` };
    }

    // Tier 5: Qualified (20 marks)
    if (ev.qualified) {
      return { tier: 'Tier 5', marks: 20, reason: 'Qualified' };
    }

    // Tier 4: Official appearance OR (15+ tests + 3 full-length + 55% avg) (15 marks)
    if (ev.official_appearance) {
      return { tier: 'Tier 4', marks: 15, reason: 'Official appearance' };
    }
    if (ev.tests_completed >= 15 && ev.full_length_tests >= 3 && ev.average_score_percent >= 55) {
      return { tier: 'Tier 4', marks: 15, reason: `15+ tests (${ev.tests_completed}), 3+ FL (${ev.full_length_tests}), 55%+ avg (${ev.average_score_percent}%)` };
    }

    // Tier 3: 10+ tests + 40% avg (10 marks)
    if (ev.tests_completed >= 10 && ev.average_score_percent >= 40) {
      return { tier: 'Tier 3', marks: 10, reason: `10+ tests (${ev.tests_completed}), 40%+ avg (${ev.average_score_percent}%)` };
    }

    // Tier 2: 5+ tests (5 marks)
    if (ev.tests_completed >= 5) {
      return { tier: 'Tier 2', marks: 5, reason: `5+ tests (${ev.tests_completed})` };
    }

    // Tier 1: diagnostic + 3 tests (3 marks)
    if (ev.diagnostic_completed && ev.tests_completed >= 3) {
      return { tier: 'Tier 1', marks: 3, reason: `Diagnostic + 3 tests (${ev.tests_completed})` };
    }

    return { tier: 'No tier', marks: 0, reason: 'Does not meet any tier criteria' };
  };

  const getBonusMarks = (examType) => {
    if (['GRE', 'GMAT', 'CAT'].includes(examType)) return 3;
    if (['TOEFL', 'IELTS', 'PTE'].includes(examType)) return 5;
    return 0;
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
          <h1>GATE Exam - Review Queue</h1>
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
            {evidence.map((item) => {
              const tierInfo = calculateCoreTier(item);
              return (
                <div key={item.id} className="evidence-item">
                  <div className="evidence-header">
                    <div className="student-info">
                      <h3>{item.student_name}</h3>
                      <span className="student-id">{item.student_id}</span>
                      <span className="department">{item.department}</span>
                      {item.is_bonus_exam && (
                        <span style={{
                          background: '#fbbf24',
                          color: '#78350f',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8em',
                          fontWeight: '600'
                        }}>
                          BONUS EXAM
                        </span>
                      )}
                    </div>
                    <div className="submission-date">
                      Submitted: {new Date(item.submitted_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="evidence-details">
                    <div style={{
                      padding: '16px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      borderLeft: '4px solid #10b981'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#065f46' }}>
                        Computed Core Marks Tier
                      </h4>
                      <div style={{ fontSize: '1.3em', fontWeight: 'bold', color: '#059669', marginBottom: '4px' }}>
                        {tierInfo.tier}: {tierInfo.marks} marks
                      </div>
                      <div style={{ fontSize: '0.9em', color: '#047857' }}>
                        {tierInfo.reason}
                      </div>
                    </div>

                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="label">Exam Type:</span>
                        <span className="value highlight">
                          {item.exam_type} {item.exam_year ? `(${item.exam_year})` : ''}
                        </span>
                      </div>

                      {item.is_bonus_exam ? (
                        <div className="detail-item">
                          <span className="label">Bonus Marks:</span>
                          <span className="value marks">
                            +{getBonusMarks(item.exam_type)} (if core ≥ 5)
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="detail-item">
                            <span className="label">Tests Completed:</span>
                            <span className="value">{item.tests_completed || 0}</span>
                          </div>

                          <div className="detail-item">
                            <span className="label">Full-Length Tests:</span>
                            <span className="value">{item.full_length_tests || 0}</span>
                          </div>

                          <div className="detail-item">
                            <span className="label">Average Score %:</span>
                            <span className="value">
                              {item.average_score_percent ? `${item.average_score_percent}%` : 'N/A'}
                            </span>
                          </div>

                          <div className="detail-item">
                            <span className="label">Diagnostic Completed:</span>
                            <span className="value">{item.diagnostic_completed ? '✅ Yes' : '❌ No'}</span>
                          </div>

                          <div className="detail-item">
                            <span className="label">Official Appearance:</span>
                            <span className="value">{item.official_appearance ? '✅ Yes' : '❌ No'}</span>
                          </div>

                          <div className="detail-item">
                            <span className="label">Qualified:</span>
                            <span className="value">{item.qualified ? '✅ Yes' : '❌ No'}</span>
                          </div>

                          {item.gate_score && (
                            <div className="detail-item">
                              <span className="label">GATE Score:</span>
                              <span className="value highlight">{item.gate_score}</span>
                            </div>
                          )}

                          {item.branch_code && (
                            <div className="detail-item">
                              <span className="label">Branch Code:</span>
                              <span className="value">{item.branch_code}</span>
                            </div>
                          )}
                        </>
                      )}

                      {item.certificate_url && (
                        <div className="detail-item full-width">
                          <span className="label">Certificate:</span>
                          <a
                            href={getProofUrl(item.certificate_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link"
                          >
                            📄 View Scorecard / Certificate →
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GateReview;
