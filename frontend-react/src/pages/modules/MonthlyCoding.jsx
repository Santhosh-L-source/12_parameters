import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const MonthlyCoding = () => {
  const navigate = useNavigate();
  const student = getStudent();

  const [stats, setStats] = useState({
    marks: 0,
    maxMarks: 20,
    averagePercentage: 0,
    assessmentsCount: 0,
  });

  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const rollNumber = student?.roll_number || student?.id_number || student?.student_id;
    if (!rollNumber) return;

    try {
      setLoading(true);
      const [evidenceRes, marksRes] = await Promise.all([
        moduleAPI.getMonthlyCodingEvidence(rollNumber),
        moduleAPI.getMonthlyCodingMarks(rollNumber),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        marks: marksRes?.marks || 0,
        maxMarks: 20,
        averagePercentage: marksRes?.average_percentage || 0,
        assessmentsCount: list.length,
      });
    } catch (error) {
      console.error('Error loading Monthly Coding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierFromPercentage = (pct) => {
    if (pct >= 80) return { tier: 'Tier 4', marks: 20, color: '#10b981' };
    if (pct >= 70) return { tier: 'Tier 3', marks: 15, color: '#6366f1' };
    if (pct >= 60) return { tier: 'Tier 2', marks: 10, color: '#3b82f6' };
    if (pct >= 50) return { tier: 'Tier 1', marks: 5, color: '#f59e0b' };
    return { tier: 'Below Tier 1', marks: 0, color: '#94a3b8' };
  };

  return (
    <div className="competition-page">
      <Header />
      <div className="container">
        <div className="breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>
            Dashboard
          </a>{' '}
          / Monthly Coding Assessment
        </div>

        <div className="page-title">
          <span>📅</span> Monthly Coding Assessment
        </div>

        {/* Informational Mentor-Evaluated Banner */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderLeft: '5px solid #3b82f6',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <span style={{ fontSize: '1.4rem' }}>ℹ️</span>
          <div>
            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.98rem', marginBottom: '4px' }}>
              Mentor-Evaluated Module
            </div>
            <div style={{ color: '#3b82f6', fontSize: '0.9rem', lineHeight: '1.5' }}>
              Your monthly coding assessment scores are directly evaluated and uploaded by your department mentors following scheduled internal tests. No form submission is required from students.
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.marks} / {stats.maxMarks}</div>
            <div className="stat-label">Computed Marks</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.averagePercentage}%</div>
            <div className="stat-label">Cumulative Average Score</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.assessmentsCount}</div>
            <div className="stat-label">Recorded Monthly Tests</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">20</div>
            <div className="stat-label">Module Max Marks</div>
          </div>
        </div>

        {/* Scoring Matrix Guide */}
        <div className="form-card" style={{ marginBottom: '24px' }}>
          <h3>📋 Monthly Coding Scoring Matrix</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '16px' }}>
            Marks are awarded based on your overall average percentage across verified monthly department assessments:
          </p>
          <div className="scoring-tier-grid">
            <div className="scoring-tier-item" style={{ background: '#f0fdf4', borderLeft: '5px solid #10b981' }}>
              <strong>20 Marks (Tier 4)</strong>
              <span>≥ 80% Average Assessment Score</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f5f3ff', borderLeft: '5px solid #8b5cf6' }}>
              <strong>15 Marks (Tier 3)</strong>
              <span>≥ 70% Average Assessment Score</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#f0f9ff', borderLeft: '5px solid #3b82f6' }}>
              <strong>10 Marks (Tier 2)</strong>
              <span>≥ 60% Average Assessment Score</span>
            </div>
            <div className="scoring-tier-item" style={{ background: '#fef3c7', borderLeft: '5px solid #f59e0b' }}>
              <strong>5 Marks (Tier 1)</strong>
              <span>≥ 50% Average Assessment Score</span>
            </div>
          </div>
        </div>

        {/* Assessment Log Table */}
        <div className="table-card">
          <div className="table-header">
            <div>
              <div className="table-title">Your Recorded Assessments</div>
              <div className="record-count">{evidenceList.length} total assessments on record</div>
            </div>
            <button className="refresh-btn" onClick={loadData} disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh Data'}
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Semester</th>
                  <th>Platform / Exam</th>
                  <th>Score Percentage</th>
                  <th>Problems Solved</th>
                  <th>Status</th>
                  <th>Recorded On</th>
                </tr>
              </thead>
              <tbody>
                {evidenceList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>No monthly assessments recorded yet</div>
                      <div style={{ fontSize: '0.88rem', marginTop: '4px' }}>
                        Your mentor will record your monthly test score after each scheduled assessment.
                      </div>
                    </td>
                  </tr>
                ) : (
                  evidenceList.map((item) => {
                    const tierInfo = getTierFromPercentage(parseFloat(item.percentage) || 0);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.month} {item.year}</strong>
                        </td>
                        <td>Semester {item.semester || 1}</td>
                        <td>{item.platform || 'Department Monthly Assessment'}</td>
                        <td>
                          <span style={{ fontWeight: 800, color: tierInfo.color, fontSize: '1.05rem' }}>
                            {item.percentage}%
                          </span>
                        </td>
                        <td>
                          {item.problems_solved !== null && item.total_problems !== null
                            ? `${item.problems_solved} / ${item.total_problems}`
                            : '—'}
                        </td>
                        <td>
                          <span className={`status-badge status-${item.status.toLowerCase()}`}>
                            {item.status === 'VERIFIED' ? '✓ Verified' : item.status}
                          </span>
                        </td>
                        <td>
                          {new Date(item.submitted_at || item.created_at || Date.now()).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyCoding;
