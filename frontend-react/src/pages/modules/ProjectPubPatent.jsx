import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const STAGE_OPTIONS = {
  PROJECT: [
    { stage: 'CONCEPT_DESIGN', label: 'Concept Design (5 Marks)', marks: 5 },
    { stage: 'WORKING_PROTOTYPE', label: 'Working Prototype (10 Marks)', marks: 10 },
    { stage: 'DEPLOYED_PRODUCT', label: 'Deployed Product (15 Marks)', marks: 15 },
    { stage: 'MONETIZED_OR_FUNDED', label: 'Monetized or Funded (20 Marks)', marks: 20 },
  ],
  PUBLICATION: [
    { stage: 'CONFERENCE_LOCAL', label: 'Local Conference (5 Marks)', marks: 5 },
    { stage: 'CONFERENCE_NATIONAL', label: 'National Conference (10 Marks)', marks: 10 },
    { stage: 'JOURNAL_INDEXED', label: 'Indexed Journal (Scopus/WoS) (15 Marks)', marks: 15 },
    { stage: 'JOURNAL_HIGH_IMPACT', label: 'High Impact Journal (20 Marks)', marks: 20 },
  ],
  PATENT: [
    { stage: 'FILED', label: 'Patent Filed (5 Marks)', marks: 5 },
    { stage: 'PUBLISHED', label: 'Patent Published (10 Marks)', marks: 10 },
    { stage: 'GRANTED', label: 'Patent Granted (20 Marks)', marks: 20 },
  ],
};

const ProjectPubPatent = () => {
  const student = getStudent();

  const [formData, setFormData] = useState({
    semester: 1,
    achievementType: 'PROJECT',
    outputName: '',
    achievementStage: 'CONCEPT_DESIGN',
    stageMarks: 5,
    proofUrl: '',
  });

  const [stats, setStats] = useState({
    marks: 0,
    maxMarks: 30,
    evidenceCount: 0,
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

  const handleTypeChange = (type) => {
    const defaultStage = STAGE_OPTIONS[type][0];
    setFormData({
      ...formData,
      achievementType: type,
      achievementStage: defaultStage.stage,
      stageMarks: defaultStage.marks,
    });
  };

  const handleStageChange = (stageName) => {
    const selected = STAGE_OPTIONS[formData.achievementType].find(s => s.stage === stageName);
    setFormData({
      ...formData,
      achievementStage: stageName,
      stageMarks: selected ? selected.marks : 5,
    });
  };

  const loadData = async () => {
    try {
      const [evidenceRes, marksRes] = await Promise.all([
        moduleAPI.getProjectPubPatentEvidence(student.roll_number),
        moduleAPI.getProjectPubPatentMarks(student.roll_number),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        marks: marksRes?.marks || 0,
        maxMarks: 30,
        evidenceCount: list.length,
      });
    } catch (error) {
      console.error('Error loading Project/Publication/Patent data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await moduleAPI.submitProjectPubPatent({
        semester: parseInt(formData.semester),
        achievement_type: formData.achievementType,
        output_name: formData.outputName,
        achievement_stage: formData.achievementStage,
        stage_marks: formData.stageMarks,
        proof_url: formData.proofUrl,
      });

      if (data.success || data.id) {
        showAlert('Project/Publication/Patent evidence submitted successfully!', 'success');
        setFormData({
          semester: 1,
          achievementType: 'PROJECT',
          outputName: '',
          achievementStage: 'CONCEPT_DESIGN',
          stageMarks: 5,
          proofUrl: '',
        });
        await loadData();
      } else {
        showAlert(data.message || data.error || 'Submission failed', 'error');
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
      <div className="competition-container">
        <div className="page-header">
          <h1>🔬 Project / Publication / Patent</h1>
          <p>Multi-track research and product development milestones (Max 30 Marks)</p>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        {/* Stats Section */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.marks} / {stats.maxMarks}</div>
            <div className="stat-label">Computed Marks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.evidenceCount}</div>
            <div className="stat-label">Outputs Submitted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">30</div>
            <div className="stat-label">Maximum Cap</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">3</div>
            <div className="stat-label">Tracks (Proj/Pub/Patent)</div>
          </div>
        </div>

        <div className="content-grid">
          {/* Form Section */}
          <div className="form-card">
            <h2>Add Research Output</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="semester">Semester *</label>
                  <select
                    id="semester"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="achievementType">Output Category *</label>
                  <select
                    id="achievementType"
                    value={formData.achievementType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    required
                  >
                    <option value="PROJECT">Project / Product</option>
                    <option value="PUBLICATION">Research Publication</option>
                    <option value="PATENT">Patent / Intellectual Property</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="outputName">Title / Output Name *</label>
                <input
                  type="text"
                  id="outputName"
                  value={formData.outputName}
                  onChange={(e) => setFormData({ ...formData, outputName: e.target.value })}
                  placeholder="e.g. AI-Powered Healthcare Diagnosis System"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="achievementStage">Milestone Stage *</label>
                <select
                  id="achievementStage"
                  value={formData.achievementStage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  required
                >
                  {STAGE_OPTIONS[formData.achievementType].map(opt => (
                    <option key={opt.stage} value={opt.stage}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Research Paper / Patent / Project Proof (PDF or JPEG/PNG)"
                  value={formData.proofUrl}
                  onChange={(url) => setFormData({ ...formData, proofUrl: url })}
                  required
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Output for Verification'}
              </button>
            </form>
          </div>

          {/* Submissions List */}
          <div className="submissions-card">
            <h2>Your Submissions ({evidenceList.length})</h2>
            {evidenceList.length === 0 ? (
              <p className="no-data">No project or publication records submitted yet.</p>
            ) : (
              <div className="evidence-list">
                {evidenceList.map((item) => (
                  <div key={item.id} className="evidence-item">
                    <div className="evidence-header">
                      <span className="event-name">[{item.achievement_type || item.achievementType}] {item.output_name || item.outputName}</span>
                      <span className={`status-badge status-${(item.status || 'PENDING').toLowerCase()}`}>
                        {item.status || 'PENDING'}
                      </span>
                    </div>
                    <div className="evidence-details">
                      <div>Stage: <strong>{item.achievement_stage || item.achievementStage}</strong> ({item.stage_marks || item.stageMarks} Marks)</div>
                      <div>Semester: {item.semester}</div>
                      {(item.proof_url || item.proofUrl) && (
                        <div>
                          <a href={item.proof_url || item.proofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
                            View Proof Document ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPubPatent;
