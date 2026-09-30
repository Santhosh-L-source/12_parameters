import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../services/api';
import Header from '../components/Header';
import './MentorDashboard.css';

const MentorDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mentees'); // 'mentees' or 'reviews'
  const [pendingCounts, setPendingCounts] = useState({});
  const [loading, setLoading] = useState(true);

  // Mentees cohort state
  const [mentees, setMentees] = useState([]);
  const [menteeOverview, setMenteeOverview] = useState(null);
  const [menteesLoading, setMenteesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [selectedMenteeModal, setSelectedMenteeModal] = useState(null);

  useEffect(() => {
    loadPendingCounts();
    loadMentees();
  }, []);

  useEffect(() => {
    if (activeTab === 'mentees') {
      loadMentees();
    }
  }, [searchTerm, selectedTier]);

  const loadPendingCounts = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        mentorAPI.getPendingHundredDays(),
        mentorAPI.getPendingLanguage(),
        mentorAPI.getPendingGate(),
        mentorAPI.getPendingCompetition(),
        mentorAPI.getPendingInternship(),
        mentorAPI.getPendingCertificate(),
        mentorAPI.getPendingAptitude(),
        mentorAPI.getPendingCodingProblems(),
        mentorAPI.getPendingCPRating(),
        mentorAPI.getPendingOpenSource(),
        mentorAPI.getPendingMonthlyCoding(),
        mentorAPI.getPendingProjectPubPatent(),
      ]);

      setPendingCounts({
        hundredDays: results[0].status === 'fulfilled' ? results[0].value?.count || 0 : 0,
        language: results[1].status === 'fulfilled' ? results[1].value?.count || 0 : 0,
        gate: results[2].status === 'fulfilled' ? results[2].value?.count || 0 : 0,
        competition: results[3].status === 'fulfilled' ? results[3].value?.count || 0 : 0,
        internship: results[4].status === 'fulfilled' ? results[4].value?.count || 0 : 0,
        certificate: results[5].status === 'fulfilled' ? results[5].value?.count || 0 : 0,
        aptitude: results[6].status === 'fulfilled' ? results[6].value?.count || 0 : 0,
        codingProblems: results[7].status === 'fulfilled' ? results[7].value?.count || 0 : 0,
        cpRating: results[8].status === 'fulfilled' ? results[8].value?.count || 0 : 0,
        openSource: results[9].status === 'fulfilled' ? results[9].value?.count || 0 : 0,
        monthlyCoding: results[10].status === 'fulfilled' ? results[10].value?.count || 0 : 0,
        projectPubPatent: results[11].status === 'fulfilled' ? results[11].value?.count || 0 : 0,
      });
    } catch (error) {
      console.error('Error loading pending counts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMentees = async () => {
    try {
      setMenteesLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedTier !== 'ALL') params.tier = selectedTier;

      const [menteesRes, overviewRes] = await Promise.allSettled([
        mentorAPI.getMyStudents(params),
        mentorAPI.getOverview(),
      ]);

      if (menteesRes.status === 'fulfilled' && menteesRes.value?.success) {
        setMentees(menteesRes.value.students || []);
      }
      if (overviewRes.status === 'fulfilled' && overviewRes.value?.success) {
        setMenteeOverview(overviewRes.value);
      }
    } catch (err) {
      console.error('Error loading mentees:', err);
    } finally {
      setMenteesLoading(false);
    }
  };

  const modules = [
    { id: 'hundred-days', name: '100 Days Training', path: '/mentor/review/hundred-days', icon: '🎯', count: pendingCounts.hundredDays || 0, maxMarks: 15 },
    { id: 'language', name: 'Foreign Language', path: '/mentor/review/language', icon: '🌍', count: pendingCounts.language || 0, maxMarks: 15 },
    { id: 'gate', name: 'GATE Exam', path: '/mentor/review/gate', icon: '📝', count: pendingCounts.gate || 0, maxMarks: 25 },
    { id: 'competition', name: 'Competitions', path: '/mentor/review/competition', icon: '🏆', count: pendingCounts.competition || 0, maxMarks: 20 },
    { id: 'internship', name: 'Internship & Startup', path: '/mentor/review/internship', icon: '💼', count: pendingCounts.internship || 0, maxMarks: 20 },
    { id: 'certificate', name: 'Certificate Achievement', path: '/mentor/review/certificate', icon: '📜', count: pendingCounts.certificate || 0, maxMarks: 20 },
    { id: 'aptitude', name: 'Aptitude & Communication', path: '/mentor/review/aptitude', icon: '🧠', count: pendingCounts.aptitude || 0, maxMarks: 20 },
    { id: 'coding-problems', name: 'Coding Problems', path: '/mentor/review/coding-problems', icon: '💻', count: pendingCounts.codingProblems || 0, maxMarks: 25 },
    { id: 'cp-rating', name: 'CP Rating', path: '/mentor/review/cp-rating', icon: '⭐', count: pendingCounts.cpRating || 0, maxMarks: 20 },
    { id: 'open-source', name: 'Open Source', path: '/mentor/review/open-source', icon: '🔓', count: pendingCounts.openSource || 0, maxMarks: 20 },
    { id: 'monthly-coding', name: 'Monthly Coding Assessment', path: '/mentor/review/monthly-coding', icon: '📅', count: pendingCounts.monthlyCoding || 0, maxMarks: 20 },
    { id: 'project-pub-patent', name: 'Project / Publication / Patent', path: '/mentor/review/project-pub-patent', icon: '🔬', count: pendingCounts.projectPubPatent || 0, maxMarks: 30 },
  ];

  const parametersList = [
    { id: 'project', name: 'Project / Publication / Patent', max: 30 },
    { id: 'coding_problems', name: 'Coding Problems Solved', max: 25 },
    { id: 'gate', name: 'GATE Examination', max: 25 },
    { id: 'competition', name: 'Competitions', max: 20 },
    { id: 'internship', name: 'Internship & Startup', max: 20 },
    { id: 'certificate', name: 'Skill Certifications', max: 20 },
    { id: 'aptitude', name: 'Aptitude & Communication', max: 20 },
    { id: 'cp_rating', name: 'CP Rating', max: 20 },
    { id: 'opensource', name: 'Open Source', max: 20 },
    { id: 'monthly_coding', name: 'Monthly Coding Assessment', max: 20 },
    { id: 'hundred_days', name: '100 Days of Code', max: 15 },
    { id: 'language', name: 'Foreign Language', max: 15 },
  ];

  const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0);

  if (loading && mentees.length === 0) {
    return (
      <div className="mentor-dashboard">
        <Header />
        <div className="container">
          <div className="loading">Loading mentor workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mentor-dashboard">
      <Header />
      <div className="container">
        {/* Header Title */}
        <div className="dashboard-header">
          <div>
            <h1>👨‍🏫 Mentor Guidance & Verification Portal</h1>
            <p>
              {menteeOverview?.mentor?.name 
                ? `Logged in as: ${menteeOverview.mentor.name} (${menteeOverview.mentor.department} Dept)` 
                : 'Manage assigned student mentees and review evidence submissions across all 12 modules'}
            </p>
          </div>
          <div className="total-pending-badge">
            <span className="count">{totalPending}</span>
            <span className="label">Total Pending Reviews</span>
          </div>
        </div>

        {/* Mentor Navigation Tabs */}
        <div className="mentor-tabs">
          <button
            className={`mentor-tab-btn ${activeTab === 'mentees' ? 'active' : ''}`}
            onClick={() => setActiveTab('mentees')}
          >
            👥 My Assigned Mentees ({menteeOverview?.stats?.totalStudents || mentees.length})
          </button>
          <button
            className={`mentor-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            📋 Module Review Queues ({totalPending} Pending)
          </button>
        </div>

        {/* TAB 1: MY ASSIGNED MENTEES */}
        {activeTab === 'mentees' && (
          <div className="mentees-tab-content">
            {/* Cohort Stats Cards */}
            <div className="mentor-stats-grid">
              <div className="mentor-stat-card blue">
                <div className="mstat-icon">🎓</div>
                <div className="mstat-info">
                  <span className="mstat-val">{menteeOverview?.stats?.totalStudents || mentees.length}</span>
                  <span className="mstat-lbl">Assigned Students</span>
                </div>
              </div>
              <div className="mentor-stat-card gold">
                <div className="mstat-icon">👑</div>
                <div className="mstat-info">
                  <span className="mstat-val">{menteeOverview?.stats?.tierCounts?.elite || 0}</span>
                  <span className="mstat-lbl">Elite Tier (200+)</span>
                </div>
              </div>
              <div className="mentor-stat-card purple">
                <div className="mstat-icon">🚀</div>
                <div className="mstat-info">
                  <span className="mstat-val">{menteeOverview?.stats?.tierCounts?.l3 || 0}</span>
                  <span className="mstat-lbl">Level 3 (160-199)</span>
                </div>
              </div>
              <div className="mentor-stat-card teal">
                <div className="mstat-icon">💼</div>
                <div className="mstat-info">
                  <span className="mstat-val">{menteeOverview?.stats?.tierCounts?.l2 || 0}</span>
                  <span className="mstat-lbl">Level 2 (120-159)</span>
                </div>
              </div>
              <div className="mentor-stat-card amber">
                <div className="mstat-icon">🌱</div>
                <div className="mstat-info">
                  <span className="mstat-val">{menteeOverview?.stats?.tierCounts?.l1 || 0}</span>
                  <span className="mstat-lbl">Level 1 (80-119)</span>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="mentee-toolbar">
              <input
                type="text"
                placeholder="🔍 Search mentee by name, roll no, or register no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mentee-search-input"
              />

              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="mentee-filter-select"
              >
                <option value="ALL">All Readiness Tiers</option>
                <option value="Elite">👑 Elite Tier (200+)</option>
                <option value="Level 3">🚀 Level 3 Product (160-199)</option>
                <option value="Level 2">💼 Level 2 Placement (120-159)</option>
                <option value="Level 1">🌱 Level 1 Foundation (80-119)</option>
                <option value="Not Eligible">⚠️ Not Eligible (&lt; 80)</option>
              </select>
            </div>

            {/* Mentees Table */}
            <div className="mentees-table-card">
              {menteesLoading ? (
                <div className="loading">Loading mentees...</div>
              ) : mentees.length === 0 ? (
                <div className="empty-state">No students found assigned to this mentor.</div>
              ) : (
                <table className="mentees-table">
                  <thead>
                    <tr>
                      <th>Mentee Name & Roll</th>
                      <th>Dept</th>
                      <th>Email</th>
                      <th>12-Param Score</th>
                      <th>Readiness Tier</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentees.map((st) => (
                      <tr key={st.id_number}>
                        <td>
                          <div className="mentee-name-cell">
                            <strong>{st.name}</strong>
                            <span className="mentee-sub">Roll: {st.id_number} | Reg: {st.register_number}</span>
                          </div>
                        </td>
                        <td><span className="dept-pill">{st.department}</span></td>
                        <td><span className="email-text">{st.email}</span></td>
                        <td>
                          <div className="mentee-score-pill">
                            <span className="score-main">{st.total_score}</span>
                            <span className="score-sub">/ 250</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="tier-badge"
                            style={{
                              backgroundColor: `${st.readiness_tier.color}22`,
                              color: st.readiness_tier.color,
                              borderColor: st.readiness_tier.color
                            }}
                          >
                            {st.readiness_tier.level}
                          </span>
                        </td>
                        <td>
                          <button
                            className="inspect-btn"
                            onClick={() => setSelectedMenteeModal(st)}
                          >
                            View Scorecard 📊
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MODULE REVIEW QUEUES */}
        {activeTab === 'reviews' && (
          <div className="modules-grid">
            {modules.map((module) => (
              <div
                key={module.id}
                className="module-card"
                onClick={() => navigate(module.path)}
              >
                <div className="module-icon">{module.icon}</div>
                <div className="module-info">
                  <h3>{module.name}</h3>
                  <div className="module-meta">
                    <span className="max-marks">Max: {module.maxMarks} marks</span>
                    {module.count > 0 ? (
                      <span className="pending-badge">{module.count} pending</span>
                    ) : (
                      <span className="no-pending">Up to date</span>
                    )}
                  </div>
                </div>
                <div className="arrow">→</div>
              </div>
            ))}
          </div>
        )}

        {/* MENTEE DETAILED SCORECARD MODAL */}
        {selectedMenteeModal && (
          <div className="modal-backdrop" onClick={() => setSelectedMenteeModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2>🎓 {selectedMenteeModal.name}</h2>
                  <p>
                    Roll: <strong>{selectedMenteeModal.id_number}</strong> | 
                    Reg: <strong>{selectedMenteeModal.register_number}</strong> | 
                    Dept: <strong>{selectedMenteeModal.department}</strong>
                  </p>
                </div>
                <button className="close-btn" onClick={() => setSelectedMenteeModal(null)}>✕</button>
              </div>

              <div className="modal-body">
                <div className="scorecard-summary-card">
                  <div className="summary-col">
                    <span className="summary-label">Total Score</span>
                    <span className="summary-val">{selectedMenteeModal.total_score} / 250</span>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">Readiness Level</span>
                    <span
                      className="tier-badge-large"
                      style={{
                        backgroundColor: `${selectedMenteeModal.readiness_tier.color}22`,
                        color: selectedMenteeModal.readiness_tier.color,
                        borderColor: selectedMenteeModal.readiness_tier.color
                      }}
                    >
                      {selectedMenteeModal.readiness_tier.tier}
                    </span>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">Modules Completed</span>
                    <span className="summary-val">{selectedMenteeModal.completed_parameters} / 12</span>
                  </div>
                </div>

                <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>12-Parameter Score Breakdown</h3>
                <div className="param-score-grid">
                  {parametersList.map((p) => {
                    const score = selectedMenteeModal.scores[p.id] || 0;
                    const pct = Math.round((score / p.max) * 100);
                    return (
                      <div key={p.id} className="param-score-card">
                        <div className="param-card-header">
                          <span className="param-card-name">{p.name}</span>
                          <span className="param-card-score">{score} / {p.max}</span>
                        </div>
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#3b82f6' : pct > 0 ? '#f59e0b' : '#64748b'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button className="primary-btn" onClick={() => setSelectedMenteeModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorDashboard;
