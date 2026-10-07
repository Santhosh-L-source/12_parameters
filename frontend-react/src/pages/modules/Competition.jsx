import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import { moduleAPI } from '../../services/api';
import { getStudent, getStudentRollNumber } from '../../utils/auth';
import './Competition.css';

const Competition = () => {
  const navigate = useNavigate();
  const student = getStudent();
  const rollNumber = getStudentRollNumber();

  const [formData, setFormData] = useState({
    eventName: '',
    roundCleared: '',
    competitionType: '',
    organizer: '',
    eventDate: '',
    certificateUrl: '',
  });

  const [stats, setStats] = useState({
    totalEvents: 0,
    verified: 0,
    pending: 0,
    marks: 0,
  });

  const [evidence, setEvidence] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    if (rollNumber) {
      loadEvidence();
      loadStats();
    }
  }, [rollNumber]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove the record for "${name}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await moduleAPI.deleteCompetitionEvidence(id);
      if (res?.success) {
        showAlert('Evidence record removed successfully', 'success');
        loadEvidence();
        loadStats();
      } else {
        showAlert(res?.message || 'Failed to remove evidence', 'error');
      }
    } catch (err) {
      showAlert('Error removing evidence. Please try again.', 'error');
    } finally {
      setDeletingId(null);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await moduleAPI.submitCompetition({
        event_name: formData.eventName,
        round_cleared: formData.roundCleared,
        competition_type: formData.competitionType || null,
        organizer: formData.organizer || null,
        event_date: formData.eventDate || null,
        certificate_url: formData.certificateUrl || null,
      });

      if (data.success) {
        showAlert('Evidence submitted successfully!', 'success');
        setFormData({
          eventName: '',
          roundCleared: '',
          competitionType: '',
          organizer: '',
          eventDate: '',
          certificateUrl: '',
        });
        loadEvidence();
        loadStats();
      } else {
        showAlert(data.message || 'Submission failed', 'error');
      }
    } catch (error) {
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async () => {
    try {
      if (!rollNumber) return;
      const data = await moduleAPI.getCompetitionEvidence(rollNumber);
      if (data?.evidence) {
        setEvidence(data.evidence);
      }
    } catch (error) {
      console.error('Error loading evidence:', error);
    }
  };

  const loadStats = async () => {
    try {
      if (!rollNumber) return;
      const data = await moduleAPI.getCompetitionMarks(rollNumber);
      if (data) {
        setStats({
          totalEvents: data.total_events || 0,
          verified: data.verified_count || 0,
          pending: data.pending_count || 0,
          marks: data.marks || 0,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };


  return (
    <div className="competition-page">
      <Header />
      <div className="container">
        <div className="breadcrumb">
          <a href="/dashboard">Dashboard</a> / Hackathons & Competitions
        </div>

        <div className="page-title">
          <span>🏆</span> Hackathons & Competitions
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`}>{alert.message}</div>
        )}

        <div className="form-card">
          <div className="card-header">
            <h3>Submit Competition Evidence</h3>
            <span className="badge">Max 20 Marks</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  value={formData.eventName}
                  onChange={(e) =>
                    setFormData({ ...formData, eventName: e.target.value })
                  }
                  placeholder="e.g. Smart India Hackathon 2024"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Round / Level Cleared *</label>
                <select
                  value={formData.roundCleared}
                  onChange={(e) =>
                    setFormData({ ...formData, roundCleared: e.target.value })
                  }
                  required
                  disabled={loading}
                >
                  <option value="">Select Level</option>
                  <option value="INTERNAL_HACKATHON">Internal Hackathon (3 Marks)</option>
                  <option value="PRELIMINARY_STAGE">Preliminary Stage (5 Marks)</option>
                  <option value="PRE_FINALS">Pre-Finals (10 Marks)</option>
                  <option value="FINALS">Finals / Grand Finale (15 Marks)</option>
                  <option value="WINNER">Winner / Top 3 (20 Marks)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Competition Type</label>
                <select
                  value={formData.competitionType}
                  onChange={(e) =>
                    setFormData({ ...formData, competitionType: e.target.value })
                  }
                  disabled={loading}
                >
                  <option value="">Select Type</option>
                  <option value="HACKATHON">Hackathon</option>
                  <option value="CODING_CONTEST">Coding Contest</option>
                  <option value="IDEATHON">Ideathon</option>
                  <option value="PROJECT_EXPO">Project Expo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Organizing Body / Institution</label>
                <input
                  type="text"
                  value={formData.organizer}
                  onChange={(e) =>
                    setFormData({ ...formData, organizer: e.target.value })
                  }
                  placeholder="e.g. Ministry of Education"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Event Date</label>
                <input
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) =>
                    setFormData({ ...formData, eventDate: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Certificate / Award Proof (PDF or JPEG/PNG)"
                  value={formData.certificateUrl}
                  onChange={(url) => setFormData({ ...formData, certificateUrl: url })}
                />
              </div>
            </div>
            <button type="submit" className="submit-btn" disabled={loading}>
              <span>🚀</span>
              {loading ? 'Submitting...' : 'Submit Evidence'}
            </button>
          </form>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>
              🏆
            </div>
            <div className="stat-value">{stats.totalEvents}</div>
            <div className="stat-label">Total Events</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
              ✓
            </div>
            <div className="stat-value">{stats.verified}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7', color: '#a16207' }}>
              ⏳
            </div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
              📊
            </div>
            <div className="stat-value">{stats.marks} / 20</div>
            <div className="stat-label">Total Marks (Capped 20)</div>
          </div>
        </div>

        <div className="table-card">
          <div className="table-header">
            <div>
              <div className="table-title">Evidence Records</div>
              <div className="record-count">
                {evidence.length} record{evidence.length !== 1 ? 's' : ''} found
              </div>
            </div>
            <button className="refresh-btn" onClick={loadEvidence}>
              🔄 Refresh
            </button>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>EVENT NAME</th>
                  <th>ROUND CLEARED</th>
                  <th>MARKS</th>
                  <th>PROOF</th>
                  <th>STATUS</th>
                  <th>SUBMITTED</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {evidence.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                      No evidence submitted yet
                    </td>
                  </tr>
                ) : (
                  evidence.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.event_name}</strong>
                      </td>
                      <td>{(e.round_cleared || '').replace(/_/g, ' ')}</td>
                      <td>
                        <strong>{e.stage_marks}</strong>
                      </td>
                      <td>
                        {e.certificate_url || e.proof_url ? (
                          <button
                            type="button"
                            className="view-btn-sm"
                            style={{
                              padding: '0.35rem 0.75rem',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.8rem'
                            }}
                            onClick={() => setPreviewDoc({ url: e.certificate_url || e.proof_url, title: `${e.event_name} Proof` })}
                          >
                            📄 View Proof
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No proof attached</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge status-${(e.status || 'pending').toLowerCase()}`}>
                          {e.status}
                        </span>
                      </td>
                      <td>{new Date(e.submitted_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="remove-btn-sm"
                          style={{
                            padding: '0.35rem 0.65rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => handleDelete(e.id, e.event_name)}
                          disabled={deletingId === e.id}
                          title="Delete this evidence submission"
                        >
                          {deletingId === e.id ? 'Removing...' : '🗑️ Remove'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        </div>

        {/* Document Viewer Modal */}
        {previewDoc && (
          <DocumentViewerModal
            isOpen={!!previewDoc}
            onClose={() => setPreviewDoc(null)}
            docUrl={previewDoc.url}
            title={previewDoc.title}
          />
        )}
      </div>
    </div>
  );
};

export default Competition;
