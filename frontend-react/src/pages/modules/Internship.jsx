import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import { moduleAPI } from '../../services/api';
import { getStudent, getStudentRollNumber } from '../../utils/auth';
import './Competition.css';

const Internship = () => {
  const student = getStudent();
  const rollNumber = getStudentRollNumber();

  const [formData, setFormData] = useState({
    track: 'RECRUITMENT',
    entityName: '',
    stage: 'INTERVIEWED',
    offerLetterUrl: '',
  });

  const [stats, setStats] = useState({
    totalMarks: 0,
    maxMarks: 20,
    submissionsCount: 0,
  });

  const [evidenceList, setEvidenceList] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    if (rollNumber) {
      loadData();
    }
  }, [rollNumber]);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadData = async () => {
    try {
      if (!rollNumber) return;
      const [evidenceRes, marksRes] = await Promise.all([
        moduleAPI.getInternshipEvidence(rollNumber),
        moduleAPI.getInternshipMarks(rollNumber),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        totalMarks: marksRes?.marks || 0,
        maxMarks: 20,
        submissionsCount: list.length,
      });
    } catch (error) {
      console.error('Error loading internship data:', error);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isRecruitment = formData.track === 'RECRUITMENT';
      const data = await moduleAPI.submitInternship({
        company_name: isRecruitment ? formData.entityName : null,
        startup_name: !isRecruitment ? formData.entityName : null,
        recruitment_stage: isRecruitment ? formData.stage : null,
        startup_stage: !isRecruitment ? formData.stage : null,
        offer_letter_url: formData.offerLetterUrl || null,
      });

      if (data.success) {
        showAlert('Internship/Startup evidence submitted successfully!', 'success');
        setFormData({
          track: 'RECRUITMENT',
          entityName: '',
          stage: 'INTERVIEWED',
          offerLetterUrl: '',
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
          <a href="/dashboard">Dashboard</a> / Internship & Startup
        </div>

        <div className="page-title">
          <span>💼</span> Internship & Startup Achievement
        </div>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalMarks} / 20</div>
            <div className="stat-label">Total Marks (Capped 20)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.submissionsCount}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>

        {/* Scoring Guide */}
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>📋 Stages & Scoring Reference</h3>
          <div className="scoring-tier-grid">
            <div className="scoring-tier-item" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981' }}>
              <strong>20 Marks</strong>
              <span>Joined / Completed Internship OR Scaled Startup</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f5f3ff', borderLeft: '5px solid #8b5cf6' }}>
              <strong>10 - 15 Marks</strong>
              <span>Offered Role / Seed Funded / Registered Startup</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f0f9ff', borderLeft: '5px solid #3b82f6' }}>
              <strong>5 - 6 Marks</strong>
              <span>Interviewed Stage / Working Prototype</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f8fafc', borderLeft: '5px solid #64748b' }}>
              <strong>2 - 4 Marks</strong>
              <span>Applied / Shortlisted / Ideation Stage</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="form-card">
          <h3>Submit Internship or Startup Record</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="track">Track *</label>
                <select
                  id="track"
                  value={formData.track}
                  onChange={(e) => {
                    const track = e.target.value;
                    setFormData({
                      ...formData,
                      track,
                      stage: track === 'RECRUITMENT' ? 'INTERVIEWED' : 'PROTOTYPE',
                    });
                  }}
                  required
                >
                  <option value="RECRUITMENT">Company Recruitment / Internship</option>
                  <option value="STARTUP">Startup / Entrepreneurship</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="entityName">{formData.track === 'RECRUITMENT' ? 'Company Name *' : 'Startup Name *'}</label>
                <input
                  type="text"
                  id="entityName"
                  value={formData.entityName}
                  onChange={(e) => setFormData({ ...formData, entityName: e.target.value })}
                  placeholder={formData.track === 'RECRUITMENT' ? 'e.g. Google, Amazon, Infosys' : 'e.g. MyTech Innovations'}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="stage">Current Milestone / Stage *</label>
                {formData.track === 'RECRUITMENT' ? (
                  <select
                    id="stage"
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    required
                  >
                    <option value="APPLIED">Applied (2 Marks)</option>
                    <option value="SHORTLISTED">Shortlisted (4 Marks)</option>
                    <option value="INTERVIEWED">Interviewed (6 Marks)</option>
                    <option value="OFFERED">Offered (10 Marks)</option>
                    <option value="JOINED">Joined (15 Marks)</option>
                    <option value="COMPLETED">Completed (20 Marks)</option>
                  </select>
                ) : (
                  <select
                    id="stage"
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    required
                  >
                    <option value="IDEATION">Ideation (3 Marks)</option>
                    <option value="PROTOTYPE">Prototype (5 Marks)</option>
                    <option value="REGISTERED">Registered (8 Marks)</option>
                    <option value="FUNDED_SEED">Funded Seed (10 Marks)</option>
                    <option value="REVENUE">Revenue (15 Marks)</option>
                    <option value="SCALED">Scaled (20 Marks)</option>
                  </select>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Offer Letter / Certificate / Proof (PDF or JPEG/PNG)"
                  value={formData.offerLetterUrl}
                  onChange={(url) => setFormData({ ...formData, offerLetterUrl: url })}
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
          <h3>Submission History</h3>
          {evidenceList.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No internship/startup evidence submitted yet.</p>
          ) : (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Stage</th>
                  <th>Proof / Document</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((item) => {
                  const proof = item.offer_letter_url || item.completion_certificate_url || item.certificate_url;
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.company_name || item.startup_name}</strong></td>
                      <td>{(item.recruitment_stage || item.startup_stage || item.role || '-').replace(/_/g, ' ')}</td>
                      <td>
                        {proof ? (
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
                            onClick={() => setPreviewDoc({ url: proof, title: `${item.company_name || item.startup_name} Proof` })}
                          >
                            📄 View Document
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
                  );
                })}
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

export default Internship;
