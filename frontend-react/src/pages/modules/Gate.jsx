import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import FileUpload from '../../components/FileUpload';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const Gate = () => {
  const student = getStudent();

  const [formData, setFormData] = useState({
    examType: 'GATE',
    examYear: new Date().getFullYear(),
    testsCompleted: '',
    fullLengthTests: '',
    averageScorePercent: '',
    diagnosticCompleted: false,
    officialAppearance: false,
    qualified: false,
    gateScore: '',
    branchCode: '',
    certificateUrl: '',
  });

  const [stats, setStats] = useState({
    totalMarks: 0,
    coreMarks: 0,
    bonusMarks: 0,
    maxMarks: 25,
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
        moduleAPI.getGateEvidence(student.roll_number),
        moduleAPI.getGateMarks(student.roll_number),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        totalMarks: marksRes?.total_marks || marksRes?.marks || 0,
        coreMarks: marksRes?.core_marks || 0,
        bonusMarks: marksRes?.bonus_marks || 0,
        maxMarks: 25,
      });
    } catch (error) {
      console.error('Error loading GATE data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await moduleAPI.submitGate({
        exam_type: formData.examType,
        exam_year: parseInt(formData.examYear),
        tests_completed: formData.testsCompleted ? parseInt(formData.testsCompleted) : 0,
        full_length_tests: formData.fullLengthTests ? parseInt(formData.fullLengthTests) : 0,
        average_score_percent: formData.averageScorePercent ? parseFloat(formData.averageScorePercent) : null,
        diagnostic_completed: formData.diagnosticCompleted,
        official_appearance: formData.officialAppearance,
        qualified: formData.qualified,
        gate_score: formData.gateScore ? parseFloat(formData.gateScore) : null,
        branch_code: formData.branchCode || null,
        certificate_url: formData.certificateUrl || null,
      });

      if (data.success) {
        showAlert('Exam evidence submitted successfully!', 'success');
        setFormData({
          examType: 'GATE',
          examYear: new Date().getFullYear(),
          testsCompleted: '',
          fullLengthTests: '',
          averageScorePercent: '',
          diagnosticCompleted: false,
          officialAppearance: false,
          qualified: false,
          gateScore: '',
          branchCode: '',
          certificateUrl: '',
        });
        loadData();
      } else {
        showAlert(data.message || 'Submission failed', 'error');
      }
    } catch (error) {
      showAlert(error.message || 'Network error. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isCoreExam = formData.examType === 'GATE';

  return (
    <div className="competition-page">
      <Header />
      <div className="container">
        <div className="breadcrumb">
          <a href="/dashboard">Dashboard</a> / GATE & Higher Studies Exam
        </div>

        <div className="page-title">
          <span>📚</span> GATE / Placement & Higher Studies Exam
        </div>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.message}</div>}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalMarks} / 25</div>
            <div className="stat-label">Total Marks (Capped 25)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.coreMarks}</div>
            <div className="stat-label">Core GATE Marks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.bonusMarks}</div>
            <div className="stat-label">Bonus Exams (+3 or +5)</div>
          </div>
        </div>

        {/* Scoring Guide */}
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>📋 Core GATE Scoring Tiers</h3>
          <div className="scoring-tier-grid">
            <div className="scoring-tier-item" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981' }}>
              <strong>25 Marks</strong>
              <span>GATE score ≥ branch threshold</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f0f9ff', borderLeft: '5px solid #3b82f6' }}>
              <strong>20 Marks</strong>
              <span>Qualified Exam</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f5f3ff', borderLeft: '5px solid #8b5cf6' }}>
              <strong>15 Marks</strong>
              <span>Official appearance OR (15+ tests, 3+ FL, 55% avg)</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#fef3c7', borderLeft: '5px solid #f59e0b' }}>
              <strong>10 Marks</strong>
              <span>10+ tests, 40% avg</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#fce7f3', borderLeft: '5px solid #ec4899' }}>
              <strong>5 Marks</strong>
              <span>5+ mock tests</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f8fafc', borderLeft: '5px solid #64748b' }}>
              <strong>3 Marks</strong>
              <span>Diagnostic + 3 tests</span>
            </div>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: '1.6', marginTop: '12px', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            💡 <strong>Bonus Exams:</strong> (GRE / GMAT / CAT: +3 Marks, TOEFL / IELTS / PTE: +5 Marks) only count if core GATE marks ≥ 5. Final total score is capped at 25 Marks.
          </p>
        </div>

        {/* Form */}
        <div className="form-card">
          <h3>Submit Exam Evidence</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="examType">Exam Type *</label>
                <select
                  id="examType"
                  value={formData.examType}
                  onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                  required
                >
                  <option value="GATE">GATE (Core - up to 25)</option>
                  <option value="GRE">GRE (Bonus +3)</option>
                  <option value="GMAT">GMAT (Bonus +3)</option>
                  <option value="CAT">CAT (Bonus +3)</option>
                  <option value="TOEFL">TOEFL (Bonus +5)</option>
                  <option value="IELTS">IELTS (Bonus +5)</option>
                  <option value="PTE">PTE (Bonus +5)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="examYear">Exam Year *</label>
                <input
                  type="number"
                  id="examYear"
                  value={formData.examYear}
                  onChange={(e) => setFormData({ ...formData, examYear: e.target.value })}
                  min="2020"
                  max="2030"
                  required
                />
              </div>

              {isCoreExam && (
                <>
                  <div className="form-group">
                    <label htmlFor="testsCompleted">Tests Completed</label>
                    <input
                      type="number"
                      id="testsCompleted"
                      value={formData.testsCompleted}
                      onChange={(e) => setFormData({ ...formData, testsCompleted: e.target.value })}
                      min="0"
                      placeholder="Total mock tests taken"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="fullLengthTests">Full-Length Tests</label>
                    <input
                      type="number"
                      id="fullLengthTests"
                      value={formData.fullLengthTests}
                      onChange={(e) => setFormData({ ...formData, fullLengthTests: e.target.value })}
                      min="0"
                      placeholder="Complete 3-hour tests"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="averageScorePercent">Average Score %</label>
                    <input
                      type="number"
                      step="0.01"
                      id="averageScorePercent"
                      value={formData.averageScorePercent}
                      onChange={(e) => setFormData({ ...formData, averageScorePercent: e.target.value })}
                      min="0"
                      max="100"
                      placeholder="Average across all tests"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="gateScore">GATE Score</label>
                    <input
                      type="number"
                      step="0.01"
                      id="gateScore"
                      value={formData.gateScore}
                      onChange={(e) => setFormData({ ...formData, gateScore: e.target.value })}
                      placeholder="e.g. 650"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="branchCode">Branch Code</label>
                    <input
                      type="text"
                      id="branchCode"
                      value={formData.branchCode}
                      onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                      placeholder="e.g. CS, EC"
                    />
                  </div>
                </>
              )}

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <FileUpload
                  label="Upload Scorecard / Hall Ticket / Result (PDF or JPEG/PNG)"
                  value={formData.certificateUrl}
                  onChange={(url) => setFormData({ ...formData, certificateUrl: url })}
                />
              </div>

              {isCoreExam && (
                <>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="diagnosticCompleted"
                      checked={formData.diagnosticCompleted}
                      onChange={(e) => setFormData({ ...formData, diagnosticCompleted: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    <label htmlFor="diagnosticCompleted" style={{ margin: 0, cursor: 'pointer' }}>Diagnostic test completed</label>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="officialAppearance"
                      checked={formData.officialAppearance}
                      onChange={(e) => setFormData({ ...formData, officialAppearance: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    <label htmlFor="officialAppearance" style={{ margin: 0, cursor: 'pointer' }}>Official examination appearance</label>
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="qualified"
                      checked={formData.qualified}
                      onChange={(e) => setFormData({ ...formData, qualified: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    <label htmlFor="qualified" style={{ margin: 0, cursor: 'pointer' }}>Qualified with valid cutoff</label>
                  </div>
                </>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Exam Evidence'}
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="form-card">
          <h3>Exam Submissions</h3>
          {evidenceList.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No exams submitted yet.</p>
          ) : (
            <table className="evidence-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Year</th>
                  <th>Type</th>
                  <th>Score</th>
                  <th>Qualified</th>
                  <th>Proof / Document</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.exam_type}</strong></td>
                    <td>{item.exam_year || '-'}</td>
                    <td>{item.is_bonus_exam ? 'Bonus' : 'Core'}</td>
                    <td>{item.gate_score || '-'}</td>
                    <td>{item.qualified ? '✅ Yes' : '❌ No'}</td>
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
                          onClick={() => setPreviewDoc({ url: item.certificate_url, title: `${item.exam_type} Scorecard Proof` })}
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
                      {item.status === 'REJECTED' && item.rejection_reason && (
                        <div style={{ fontSize: '0.85em', color: '#dc2626', marginTop: '4px' }}>
                          {item.rejection_reason}
                        </div>
                      )}
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

export default Gate;
