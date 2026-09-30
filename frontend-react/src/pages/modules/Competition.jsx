import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const Competition = () => {
  const navigate = useNavigate();
  const student = getStudent();

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

  useEffect(() => {
    loadEvidence();
    loadStats();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
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
        const errorMsg = data.message || (data.errors && data.errors.map(e => e.msg).join(', ')) || data.error || 'Submission failed';
        showAlert(errorMsg, 'error');
      }
    } catch (error) {
      showAlert(error.message || 'Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadEvidence = async () => {
    try {
      const data = await moduleAPI.getCompetitionEvidence(student.roll_number);
      setEvidence(data.evidence || []);
    } catch (error) {
      console.error('Error loading evidence:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [evidenceData, marksData] = await Promise.all([
        moduleAPI.getCompetitionEvidence(student.roll_number),
        moduleAPI.getCompetitionMarks(student.roll_number),
      ]);

      const evidenceList = evidenceData.evidence || [];
      setStats({
        totalEvents: evidenceList.length,
        verified: evidenceList.filter((e) => e.status === 'VERIFIED').length,
        pending: evidenceList.filter((e) => e.status === 'PENDING').length,
        marks: marksData.marks || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="competition-page">
      <Header />
      <div className="container">
        <div className="breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>
            Dashboard
          </a>{' '}
          / Competition Achievement
        </div>

        <h1 className="page-title">
          <span>🏆</span>
          Competition Achievement
        </h1>

        {alert && (
          <div className={`alert alert-${alert.type}`}>{alert.message}</div>
        )}

        <div className="form-card">
          <h3>Submit New Evidence</h3>
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
                  required
                  placeholder="e.g. Smart India Hackathon"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Round Cleared *</label>
                <select
                  value={formData.roundCleared}
                  onChange={(e) =>
                    setFormData({ ...formData, roundCleared: e.target.value })
                  }
                  required
                  disabled={loading}
                >
                  <option value="">Select Round</option>
                  <option value="VALID_COMPLETION">
                    Valid Completion (2 marks)
                  </option>
                  <option value="PRELIM">Preliminary (4 marks)</option>
                  <option value="SECOND_ROUND">Second Round (6 marks)</option>
                  <option value="REGIONAL_FINALIST">
                    Regional Finalist (10 marks)
                  </option>
                  <option value="NATIONAL_FINALIST">
                    National Finalist (15 marks)
                  </option>
                  <option value="INTERNATIONAL_WINNER">
                    International Winner (20 marks)
                  </option>
                </select>
              </div>
              <div className="form-group">
                <label>Competition Type</label>
                <input
                  type="text"
                  value={formData.competitionType}
                  onChange={(e) =>
                    setFormData({ ...formData, competitionType: e.target.value })
                  }
                  placeholder="e.g. HACKATHON"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Organizer</label>
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
              {loading ? 'Submitting...' : 'Submit & Fetch'}
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
                  <th>STATUS</th>
                  <th>SUBMITTED</th>
                </tr>
              </thead>
              <tbody>
                {evidence.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                      No evidence submitted yet
                    </td>
                  </tr>
                ) : (
                  evidence.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.event_name}</strong>
                      </td>
                      <td>{e.round_cleared.replace(/_/g, ' ')}</td>
                      <td>
                        <strong>{e.stage_marks}</strong>
                      </td>
                      <td>
                        <span className={`status-badge status-${e.status.toLowerCase()}`}>
                          {e.status}
                        </span>
                      </td>
                      <td>{new Date(e.submitted_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Competition;
