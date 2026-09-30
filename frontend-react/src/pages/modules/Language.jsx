import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const Language = () => {
  const student = getStudent();

  const [formData, setFormData] = useState({
    language: 'German',
    proficiencyLevel: 'A1',
    certificationName: '',
    certificateUrl: '',
  });

  const [stats, setStats] = useState({
    totalSubmissions: 0,
    marks: 0,
    maxMarks: 15,
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
        moduleAPI.getLanguageEvidence(student.roll_number),
        moduleAPI.getLanguageMarks(student.roll_number),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        totalSubmissions: list.length,
        marks: marksRes?.marks || 0,
        maxMarks: 15,
      });
    } catch (error) {
      console.error('Error loading language data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await moduleAPI.submitLanguage({
        language: formData.language,
        proficiency_level: formData.proficiencyLevel,
        certification_name: formData.certificationName || null,
        certificate_url: formData.certificateUrl || null,
      });

      if (data.success) {
        showAlert('Foreign Language certification submitted successfully!', 'success');
        setFormData({
          language: 'German',
          proficiencyLevel: 'A1',
          certificationName: '',
          certificateUrl: '',
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
          <a href="/dashboard">Dashboard</a> / Foreign Language
        </div>

        <div className="page-title">
          <span>🌍</span> Foreign Language Achievement
        </div>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.marks} / 15</div>
            <div className="stat-label">Total Marks (Max Tier)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalSubmissions}</div>
            <div className="stat-label">Certifications Submitted</div>
          </div>
        </div>

        {/* Scoring Guide */}
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>📋 Scoring Reference (Non-English, Highest Level Counts)</h3>
          <div className="scoring-tier-grid">
            <div className="scoring-tier-item" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981' }}>
              <strong>15 Marks</strong>
              <span>B1 Level or Higher (Advanced)</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f0f9ff', borderLeft: '5px solid #3b82f6' }}>
              <strong>12 Marks</strong>
              <span>A2 Level (Intermediate)</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#fef3c7', borderLeft: '5px solid #f59e0b' }}>
              <strong>7 Marks</strong>
              <span>A1 Level (Elementary)</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="form-card">
          <h3>Submit Language Certification</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="language">Foreign Language *</label>
                <select
                  id="language"
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  required
                >
                  <option value="German">German</option>
                  <option value="French">French</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Mandarin">Mandarin</option>
                  <option value="Korean">Korean</option>
                  <option value="Russian">Russian</option>
                  <option value="Italian">Italian</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="proficiencyLevel">Proficiency Level *</label>
                <select
                  id="proficiencyLevel"
                  value={formData.proficiencyLevel}
                  onChange={(e) => setFormData({ ...formData, proficiencyLevel: e.target.value })}
                  required
                >
                  <option value="A1">A1 (7 Marks)</option>
                  <option value="A2">A2 (12 Marks)</option>
                  <option value="B1">B1 (15 Marks)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="certificationName">Exam / Certification Name</label>
                <input
                  type="text"
                  id="certificationName"
                  value={formData.certificationName}
                  onChange={(e) => setFormData({ ...formData, certificationName: e.target.value })}
                  placeholder="e.g. Goethe-Zertifikat A1, DELF B1"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Language Certificate / Scorecard (PDF or JPEG/PNG)"
                  value={formData.certificateUrl}
                  onChange={(url) => setFormData({ ...formData, certificateUrl: url })}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Certification'}
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="form-card">
          <h3>Certification History</h3>
          {evidenceList.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No language certifications submitted yet.</p>
          ) : (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Language</th>
                  <th>Level</th>
                  <th>Certification</th>
                  <th>Status</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.language}</strong></td>
                    <td>{item.proficiency_level}</td>
                    <td>{item.certification_name || '-'}</td>
                    <td>
                      <span className={`status-badge status-${(item.status || 'pending').toLowerCase()}`}>
                        {item.status || 'PENDING'}
                      </span>
                    </td>
                    <td>{item.status === 'VERIFIED' ? (item.proficiency_level === 'B1' ? 15 : item.proficiency_level === 'A2' ? 12 : 7) : '-'}</td>
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

export default Language;
