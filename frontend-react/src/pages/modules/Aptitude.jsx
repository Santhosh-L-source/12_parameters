import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const Aptitude = () => {
  const student = getStudent();

  const [formData, setFormData] = useState({
    eventType: 'APTITUDE',
    eventName: '',
    achievementLevel: 'QUALIFIED',
    proofUrl: '',
  });

  const [stats, setStats] = useState({
    totalMarks: 0,
    aptitudeMarks: 0,
    communicationMarks: 0,
    maxMarks: 20,
  });

  const [evidenceList, setEvidenceList] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadData = async () => {
    try {
      const [evidenceRes, marksRes] = await Promise.all([
        moduleAPI.getAptitudeEvidence(student.roll_number),
        moduleAPI.getAptitudeMarks(student.roll_number),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        totalMarks: marksRes?.marks || 0,
        aptitudeMarks: marksRes?.aptitude_marks || 0,
        communicationMarks: marksRes?.communication_marks || 0,
        maxMarks: 20,
      });
    } catch (error) {
      console.error('Error loading aptitude data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isAptitude = formData.eventType === 'APTITUDE';
      const data = await moduleAPI.submitAptitude({
        event_name: formData.eventName,
        event_type: formData.eventType,
        aptitude_level: isAptitude ? formData.achievementLevel : null,
        communication_level: !isAptitude ? formData.achievementLevel : null,
        certificate_url: formData.proofUrl || null,
      });

      if (data.success) {
        showAlert('Aptitude/Communication evidence submitted successfully!', 'success');
        setFormData({
          eventType: 'APTITUDE',
          eventName: '',
          achievementLevel: 'QUALIFIED',
          proofUrl: '',
        });
        loadData();
      } else {
        showAlert(data.message || 'Submission failed', 'error');
      }
    } catch (error) {
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="competition-page">
      <Header />
      <div className="container">
        <div className="breadcrumb">
          <a href="/dashboard">Dashboard</a> / Aptitude & Communication
        </div>

        <div className="page-title">
          <span>🗣️</span> Aptitude & Communication Achievement
        </div>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalMarks} / 20</div>
            <div className="stat-label">Total Marks (Capped 20)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.aptitudeMarks}</div>
            <div className="stat-label">Aptitude Track Marks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.communicationMarks}</div>
            <div className="stat-label">Communication Track Marks</div>
          </div>
        </div>

        {/* Scoring Guide */}
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>📋 Levels & Scoring Reference</h3>
          <div className="scoring-tier-grid">
            <div className="scoring-tier-item" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981' }}>
              <strong>20 Marks</strong>
              <span>≥90th Percentile Aptitude / International Speaker</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f5f3ff', borderLeft: '5px solid #8b5cf6' }}>
              <strong>10 - 15 Marks</strong>
              <span>≥70-80th Percentile / National Winner or Finalist</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f0f9ff', borderLeft: '5px solid #3b82f6' }}>
              <strong>5 - 6 Marks</strong>
              <span>≥60th Percentile / Qualified Semifinalist</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f8fafc', borderLeft: '5px solid #64748b' }}>
              <strong>3 Marks</strong>
              <span>≥50th Percentile / Regional Participant</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="form-card">
          <h3>Submit Event Evidence</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="eventType">Category Track *</label>
                <select
                  id="eventType"
                  value={formData.eventType}
                  onChange={(e) => {
                    const type = e.target.value;
                    setFormData({
                      ...formData,
                      eventType: type,
                      achievementLevel: type === 'APTITUDE' ? 'QUALIFIED' : 'FINALIST',
                    });
                  }}
                  required
                >
                  <option value="APTITUDE">Aptitude & Technical Contests</option>
                  <option value="COMMUNICATION">Communication & Debate / Public Speaking</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="eventName">Event / Competition Name *</label>
                <input
                  type="text"
                  id="eventName"
                  value={formData.eventName}
                  onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
                  placeholder="e.g. National Aptitude Challenge, Inter-College Debate"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="achievementLevel">Achievement Level *</label>
                {formData.eventType === 'APTITUDE' ? (
                  <select
                    id="achievementLevel"
                    value={formData.achievementLevel}
                    onChange={(e) => setFormData({ ...formData, achievementLevel: e.target.value })}
                    required
                  >
                    <option value="PARTICIPATED">Participated (2 Marks)</option>
                    <option value="QUALIFIED">Qualified (5 Marks)</option>
                    <option value="REGIONAL_WINNER">Regional Winner (10 Marks)</option>
                    <option value="NATIONAL_WINNER">National Winner (15 Marks)</option>
                    <option value="INTERNATIONAL_WINNER">International Winner (20 Marks)</option>
                  </select>
                ) : (
                  <select
                    id="achievementLevel"
                    value={formData.achievementLevel}
                    onChange={(e) => setFormData({ ...formData, achievementLevel: e.target.value })}
                    required
                  >
                    <option value="PARTICIPATED">Participated (2 Marks)</option>
                    <option value="SEMIFINALIST">Semifinalist (5 Marks)</option>
                    <option value="FINALIST">Finalist (10 Marks)</option>
                    <option value="WINNER">Winner (15 Marks)</option>
                    <option value="BEST_SPEAKER">Best Speaker (20 Marks)</option>
                  </select>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Event Certificate / Scorecard (PDF or JPEG/PNG)"
                  value={formData.proofUrl}
                  onChange={(url) => setFormData({ ...formData, proofUrl: url })}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Evidence'}
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="form-card">
          <h3>Submitted Events</h3>
          {evidenceList.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No aptitude or communication evidence submitted yet.</p>
          ) : (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Track</th>
                  <th>Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.event_name}</strong></td>
                    <td>{item.event_type || (item.aptitude_level ? 'APTITUDE' : 'COMMUNICATION')}</td>
                    <td>{(item.aptitude_level || item.communication_level || '-').replace(/_/g, ' ')}</td>
                    <td>
                      <span className={`status-badge status-${(item.status || 'pending').toLowerCase()}`}>
                        {item.status || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Aptitude;
