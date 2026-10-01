import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const Certificate = () => {
  const student = getStudent();

  const [formData, setFormData] = useState({
    credentialName: '',
    credentialCategory: 'INDUSTRY',
    tierLevel: 'PROFESSIONAL',
    issuingOrganization: '',
    certificateUrl: '',
  });

  const [stats, setStats] = useState({
    totalMarks: 0,
    maxMarks: 20,
    credentialsCount: 0,
    foundationMarks: 0,
  });

  const [evidenceList, setEvidenceList] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

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
        moduleAPI.getCertificateEvidence(student.roll_number),
        moduleAPI.getCertificateMarks(student.roll_number),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        totalMarks: marksRes?.marks || 0,
        maxMarks: 20,
        credentialsCount: marksRes?.credentials_count || list.length,
        foundationMarks: marksRes?.foundation_marks_capped || 0,
      });
    } catch (error) {
      console.error('Error loading certificate data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await moduleAPI.submitCertificate({
        credential_name: formData.credentialName,
        credential_category: formData.credentialCategory,
        tier_level: formData.tierLevel,
        issuing_organization: formData.issuingOrganization || null,
        certificate_url: formData.certificateUrl || null,
      });

      if (data.success) {
        showAlert('Certificate evidence submitted successfully!', 'success');
        setFormData({
          credentialName: '',
          credentialCategory: 'INDUSTRY',
          tierLevel: 'PROFESSIONAL',
          issuingOrganization: '',
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
          <a href="/dashboard">Dashboard</a> / Certificate Achievement
        </div>

        <div className="page-title">
          <span>🎓</span> Certificate Achievement
        </div>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalMarks} / 20</div>
            <div className="stat-label">Total Marks (Capped 20)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.credentialsCount}</div>
            <div className="stat-label">Verified / Submitted Credentials</div>
          </div>
        </div>

        {/* Scoring Guide */}
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>📋 Certificate Tiers Reference</h3>
          <div className="scoring-tier-grid">
            <div className="scoring-tier-item" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981' }}>
              <strong>10 - 15 Marks</strong>
              <span>Industry: Expert / Professional</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f5f3ff', borderLeft: '5px solid #8b5cf6' }}>
              <strong>5 Marks</strong>
              <span>Industry: Associate</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f0f9ff', borderLeft: '5px solid #3b82f6' }}>
              <strong>10 Marks</strong>
              <span>Academic: Advanced (NPTEL / Coursera)</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f8fafc', borderLeft: '5px solid #64748b' }}>
              <strong>3 - 5 Marks</strong>
              <span>Academic: Basic / Intermediate</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="form-card">
          <h3>Submit Certificate Credential</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="credentialCategory">Credential Category *</label>
                <select
                  id="credentialCategory"
                  value={formData.credentialCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setFormData({
                      ...formData,
                      credentialCategory: cat,
                      tierLevel: cat === 'INDUSTRY' ? 'PROFESSIONAL' : 'ADVANCED',
                    });
                  }}
                  required
                >
                  <option value="INDUSTRY">Industry (AWS, Google, Microsoft, etc.)</option>
                  <option value="ACADEMIC">Academic / NPTEL / Coursera Specialization</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="credentialName">Certificate / Credential Title *</label>
                <input
                  type="text"
                  id="credentialName"
                  value={formData.credentialName}
                  onChange={(e) => setFormData({ ...formData, credentialName: e.target.value })}
                  placeholder="e.g. AWS Certified Solutions Architect, NPTEL Elite"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="tierLevel">Tier Level *</label>
                {formData.credentialCategory === 'INDUSTRY' ? (
                  <select
                    id="tierLevel"
                    value={formData.tierLevel}
                    onChange={(e) => setFormData({ ...formData, tierLevel: e.target.value })}
                    required
                  >
                    <option value="ASSOCIATE">Associate (5 Marks)</option>
                    <option value="PROFESSIONAL">Professional (10 Marks)</option>
                    <option value="EXPERT">Expert (15 Marks)</option>
                  </select>
                ) : (
                  <select
                    id="tierLevel"
                    value={formData.tierLevel}
                    onChange={(e) => setFormData({ ...formData, tierLevel: e.target.value })}
                    required
                  >
                    <option value="BASIC">Basic (3 Marks)</option>
                    <option value="INTERMEDIATE">Intermediate (5 Marks)</option>
                    <option value="ADVANCED">Advanced (10 Marks)</option>
                    <option value="EXPERT">Expert (15 Marks)</option>
                  </select>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="issuingOrganization">Issuing Authority / Organization</label>
                <input
                  type="text"
                  id="issuingOrganization"
                  value={formData.issuingOrganization}
                  onChange={(e) => setFormData({ ...formData, issuingOrganization: e.target.value })}
                  placeholder="e.g. Amazon Web Services, IIT Madras"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Certificate / Credential Proof (PDF or JPEG/PNG)"
                  value={formData.certificateUrl}
                  onChange={(url) => setFormData({ ...formData, certificateUrl: url })}
                />
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Certificate'}
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="form-card">
          <h3>Submitted Certificates</h3>
          {evidenceList.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No certificates submitted yet.</p>
          ) : (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Credential Name</th>
                  <th>Category</th>
                  <th>Tier</th>
                  <th>Proof / Document</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.credential_name}</strong></td>
                    <td>{item.credential_category}</td>
                    <td>{item.tier_level}</td>
                    <td>
                      {item.certificate_url ? (
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
                          onClick={() => setPreviewDoc({ url: item.certificate_url, title: item.credential_name })}
                        >
                          📄 View Certificate
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No proof attached</span>
                      )}
                    </td>
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

export default Certificate;
