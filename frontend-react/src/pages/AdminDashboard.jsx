import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { mentorAPI, adminAPI } from '../services/api';
import './AdminDashboard.css';

const API_BASE_URL = 'http://localhost:3005';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mentors'); // mentors, uploader, anomalies, parameters

  // Selected Mentor for Cohort View
  const [selectedMentor, setSelectedMentor] = useState(null);

  // Student Scores Matrix State (for selected mentor's cohort)
  const [students, setStudents] = useState([]);
  const [scoreStats, setScoreStats] = useState(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1, limit: 50 });
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  // Mentor Assignment State
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [assignTargetMentor, setAssignTargetMentor] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

  // Uploader State
  const [uploadFile, setUploadFile] = useState(null);
  const [semester, setSemester] = useState(4);
  const [month, setMonth] = useState('September 2026');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Anomalies state
  const [anomalies, setAnomalies] = useState([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Review queues count
  const [pendingCounts, setPendingCounts] = useState({});

  useEffect(() => {
    loadPendingCounts();
    loadMentors();
    loadAnomalies();
  }, []);

  useEffect(() => {
    if (activeTab === 'mentors' && selectedMentor) {
      loadStudentScores();
    }
  }, [activeTab, selectedMentor, searchTerm, selectedDept, selectedTier, page]);

  const loadPendingCounts = async () => {
    try {
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
    } catch (e) {
      console.error('Error loading pending counts:', e);
    }
  };

  const loadStudentScores = async () => {
    try {
      setScoreLoading(true);
      const params = {
        page,
        limit: 50,
      };
      if (searchTerm) params.search = searchTerm;
      if (selectedDept !== 'ALL') params.department = selectedDept;
      if (selectedTier !== 'ALL') params.tier = selectedTier;
      if (selectedMentor) {
        params.mentor_id = (selectedMentor.id_number === '__UNASSIGNED__' || selectedMentor.id_number === 'UNASSIGNED') 
          ? 'UNASSIGNED' 
          : selectedMentor.id_number;
      }

      const data = await adminAPI.getStudentScores(params);
      if (data.success) {
        setStudents(data.students || []);
        setScoreStats(data.stats || null);
        setPagination(data.pagination || { total: 0, total_pages: 1, limit: 50 });
      }
    } catch (err) {
      console.error('Error loading student scores:', err);
    } finally {
      setScoreLoading(false);
    }
  };

  const loadMentors = async () => {
    try {
      setMentorsLoading(true);
      const data = await adminAPI.getMentors();
      if (data.success) {
        setMentors(data.mentors || []);
        if (data.mentors.length > 0 && !assignTargetMentor) {
          setAssignTargetMentor(data.mentors[0].id_number);
        }
      }
    } catch (err) {
      console.error('Error loading mentors:', err);
    } finally {
      setMentorsLoading(false);
    }
  };

  const loadAnomalies = async () => {
    try {
      setAnomalyLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/anomaly/flags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAnomalies(data.anomalies || []);
      }
    } catch (err) {
      console.error('Error loading anomalies:', err);
    } finally {
      setAnomalyLoading(false);
    }
  };

  const triggerIntegrityScan = async () => {
    try {
      setScanning(true);
      setScanResult(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/anomaly/scan-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setScanResult(data);
      loadAnomalies();
    } catch (err) {
      console.error('Integrity scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const resolveAnomaly = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      const notes = prompt(`Enter resolution notes for ${status}:`, `Marked as ${status} by admin`);
      if (notes === null) return;

      const res = await fetch(`${API_BASE_URL}/api/anomaly/resolve/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, notes })
      });
      const data = await res.json();
      if (data.success) {
        loadAnomalies();
      }
    } catch (err) {
      console.error('Error resolving anomaly:', err);
    }
  };

  const [importJob, setImportJob] = useState(null);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    try {
      setUploadLoading(true);
      setUploadStatus(null);
      setImportJob(null);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('semester', semester);
      formData.append('month', month);
      formData.append('uploadedBy', 'ADMIN');

      const data = await adminAPI.uploadMonthlyCoding(formData);

      if (data.jobId) {
        setImportJob({ id: data.jobId, status: 'PROCESSING', total_rows: data.totalRows || 0, processed_rows: 0 });

        // Poll for job completion
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await adminAPI.getImportJobStatus(data.jobId);
            if (statusRes.success && statusRes.job) {
              const job = statusRes.job;
              setImportJob(job);

              if (job.status === 'COMPLETED') {
                clearInterval(pollInterval);
                setUploadLoading(false);
                setUploadStatus({
                  message: `Successfully processed ${job.processed_rows} student scores in ${job.summary?.totalTimeSeconds || '1.5'}s!`,
                  summary: job.summary
                });
                loadStudentScores();
              } else if (job.status === 'FAILED') {
                clearInterval(pollInterval);
                setUploadLoading(false);
                setUploadStatus({
                  error: job.error_log?.message || 'Background import job failed.'
                });
              }
            }
          } catch (pollErr) {
            console.error('Job polling error:', pollErr);
          }
        }, 500);

      } else if (data.success) {
        setUploadStatus(data);
        setUploadLoading(false);
      } else {
        let errorMsg = data.error || data.message;
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          errorMsg = data.errors.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
        }
        if (!errorMsg) errorMsg = 'Upload failed. Please check the uploaded file.';
        setUploadStatus({ error: errorMsg });
        setUploadLoading(false);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus({ error: err.message || 'Network or server error during upload.' });
      setUploadLoading(false);
    }
  };

  const handleAssignSelectedStudents = async () => {
    if (selectedStudentIds.length === 0) {
      alert('Please select at least one student to assign.');
      return;
    }
    if (!assignTargetMentor) {
      alert('Please select a mentor.');
      return;
    }

    try {
      setAssignLoading(true);
      setAssignSuccessMsg('');
      const res = await adminAPI.assignMentor(selectedStudentIds, assignTargetMentor);
      if (res.success) {
        setAssignSuccessMsg(`Successfully assigned ${selectedStudentIds.length} student(s) to ${res.mentor?.name}!`);
        setSelectedStudentIds([]);
        loadStudentScores();
        loadMentors();
      } else {
        alert(res.error || 'Failed to assign mentor');
      }
    } catch (err) {
      console.error('Assign error:', err);
      alert('Error during mentor assignment.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAutoAssignByDept = async () => {
    if (!window.confirm('Auto-assign all unassigned students to their respective department mentors (CSE -> MENTOR_CSE, IT -> MENTOR_IT, etc.)?')) {
      return;
    }
    try {
      setAssignLoading(true);
      const res = await adminAPI.autoAssignDepartments();
      if (res.success) {
        alert('Auto-assignment completed successfully!');
        loadStudentScores();
        loadMentors();
      }
    } catch (err) {
      console.error('Auto assign error:', err);
    } finally {
      setAssignLoading(false);
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudentIds(students.map(s => s.id_number));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const toggleStudentSelection = (id) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0);

  const parametersList = [
    { id: 'project', name: 'Project / Publication / Patent', max: 30, strategy: 'Group by distinct entity, MAX stage, SUM capped at 30' },
    { id: 'coding_problems', name: 'Coding Problems Solved', max: 25, strategy: 'Dual-threshold lookup (Total Solved + SQL Solved)' },
    { id: 'gate', name: 'GATE Examination', max: 25, strategy: 'Core Marks Tier + Branch Calibration Bonus' },
    { id: 'competition', name: 'Hackathons & Competitions', max: 20, strategy: 'SUM distinct event stages, capped at 20' },
    { id: 'internship', name: 'Internship & Startup Incubation', max: 20, strategy: 'SUM distinct company/startup stages, capped at 20' },
    { id: 'certificate', name: 'Skill Certifications', max: 20, strategy: 'Highest tier per credential, SUM distinct, Foundation cap 10' },
    { id: 'aptitude', name: 'Aptitude & Communication', max: 20, strategy: 'Best Aptitude (15) + Best Communication (5)' },
    { id: 'cp_rating', name: 'Competitive Programming Rating', max: 20, strategy: 'SINGLE BEST rating across platforms (CF, CC, LC)' },
    { id: 'opensource', name: 'Open Source Contributions', max: 20, strategy: 'SUM distinct repos, highest stage per repo, cap 20' },
    { id: 'monthly_coding', name: 'Monthly Coding Assessment', max: 20, strategy: 'Tiered average percentage across semester assessments' },
    { id: 'hundred_days', name: '100 Days of Code Training', max: 15, strategy: 'One-time milestone tier based on completed days' },
    { id: 'language', name: 'Foreign Language Certification', max: 15, strategy: 'Max proficiency level achieved (A1=7, A2=12, B1=15)' },
  ];

  const handleSelectMentor = (mentor) => {
    setSelectedMentor(mentor);
    setPage(1);
    setSearchTerm('');
    setSelectedTier('ALL');
    setSelectedStudentIds([]);
  };

  const handleBackToMentors = () => {
    setSelectedMentor(null);
    setSelectedStudentIds([]);
    setStudents([]);
    loadMentors();
  };

  return (
    <div className="admin-dashboard">
      <Header />
      <div className="admin-container">
        {/* Top Header */}
        <div className="admin-header">
          <div>
            <h1>⚙️ Admin Control & Academic Center</h1>
            <p>Supervise student readiness scores (250 marks), mentor allocations, and fraud anomaly detection</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button
            className={`tab-btn ${activeTab === 'mentors' ? 'active' : ''}`}
            onClick={() => { setActiveTab('mentors'); setSelectedMentor(null); }}
          >
            👥 Mentors & Cohorts ({mentors.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'uploader' ? 'active' : ''}`}
            onClick={() => setActiveTab('uploader')}
          >
            📥 Batch Score Uploader
          </button>
          <button
            className={`tab-btn ${activeTab === 'parameters' ? 'active' : ''}`}
            onClick={() => setActiveTab('parameters')}
          >
            ⚖️ 12-Parameter Rules (250 Marks)
          </button>
        </div>

        {/* TAB: MENTORS & COHORTS */}
        {activeTab === 'mentors' && (
          <div className="tab-content">
            {!selectedMentor ? (
              /* VIEW A: MENTOR DIRECTORY */
              <div>
                <div className="section-header-row">
                  <div>
                    <h2>👥 Faculty Mentors & Student Cohorts</h2>
                    <p>Click on any mentor to inspect their assigned mentees, student scores, and progress matrix</p>
                  </div>
                  <button 
                    className="primary-btn"
                    onClick={handleAutoAssignByDept}
                    disabled={assignLoading}
                  >
                    ⚡ Auto-Assign All Unassigned Students by Dept
                  </button>
                </div>

                <div className="mentors-grid">
                  {mentors.map((m) => (
                    <div 
                      key={m.id_number} 
                      className="mentor-card clickable-mentor-card"
                      onClick={() => handleSelectMentor(m)}
                    >
                      <div className="mentor-header">
                        <div className="mentor-avatar">👨‍🏫</div>
                        <div>
                          <h3>{m.name}</h3>
                          <span className="mentor-dept-tag">Dept: {m.department || 'General'}</span>
                        </div>
                      </div>
                      <div className="mentor-body">
                        <p className="mentor-email">✉️ {m.email}</p>
                        <p className="mentor-id">ID: <code>{m.id_number}</code></p>
                        <div className="mentor-load-badge">
                          <span className="load-num">{m.assigned_count}</span>
                          <span className="load-label">Assigned Mentees</span>
                        </div>
                      </div>
                      <div className="mentor-footer">
                        <button 
                          className="view-btn primary-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectMentor(m);
                          }}
                        >
                          View Cohort Students ({m.assigned_count}) →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* VIEW B: DEDICATED MENTOR COHORT VIEW */
              <div className="cohort-detail-view">
                {/* Cohort Header Banner */}
                <div className="cohort-header-banner">
                  <button 
                    className="back-btn"
                    onClick={handleBackToMentors}
                  >
                    ← Back to All Mentors
                  </button>
                  <div className="cohort-header-info">
                    <div className="cohort-avatar">👨‍🏫</div>
                    <div>
                      <h2>{selectedMentor.name} — Student Cohort</h2>
                      <p>
                        <strong>Department:</strong> {selectedMentor.department || 'General'} &nbsp;|&nbsp; 
                        <strong>Mentor ID:</strong> <code>{selectedMentor.id_number}</code> &nbsp;|&nbsp; 
                        <strong>Total Mentees:</strong> {pagination.total} students
                      </p>
                    </div>
                  </div>
                </div>

                {/* KPI Overview Cards for this Mentor */}
                <div className="stats-cards-grid">
                  <div className="stat-card blue">
                    <div className="stat-icon">👥</div>
                    <div className="stat-info">
                      <span className="stat-value">{pagination.total || 0}</span>
                      <span className="stat-label">Assigned Mentees</span>
                    </div>
                  </div>
                  <div className="stat-card gold">
                    <div className="stat-icon">👑</div>
                    <div className="stat-info">
                      <span className="stat-value">{scoreStats?.elite || 0}</span>
                      <span className="stat-label">Elite Tier (200+)</span>
                    </div>
                  </div>
                  <div className="stat-card purple">
                    <div className="stat-icon">🚀</div>
                    <div className="stat-info">
                      <span className="stat-value">{scoreStats?.l3 || 0}</span>
                      <span className="stat-label">Level 3 (160-199)</span>
                    </div>
                  </div>
                  <div className="stat-card teal">
                    <div className="stat-icon">💼</div>
                    <div className="stat-info">
                      <span className="stat-value">{scoreStats?.l2 || 0}</span>
                      <span className="stat-label">Level 2 (120-159)</span>
                    </div>
                  </div>
                  <div className="stat-card amber">
                    <div className="stat-icon">🌱</div>
                    <div className="stat-info">
                      <span className="stat-value">{scoreStats?.l1 || 0}</span>
                      <span className="stat-label">Level 1 (80-119)</span>
                    </div>
                  </div>
                </div>

                {/* Filter & Batch Action Toolbar */}
                <div className="matrix-toolbar">
                  <div className="search-filter-group">
                    <input
                      type="text"
                      placeholder={`🔍 Search in ${selectedMentor.name}'s students (name, roll, reg)...`}
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                      className="search-input"
                    />

                    <select 
                      value={selectedTier} 
                      onChange={(e) => { setSelectedTier(e.target.value); setPage(1); }}
                      className="filter-select"
                    >
                      <option value="ALL">All Readiness Tiers</option>
                      <option value="Elite">👑 Elite Tier (200+)</option>
                      <option value="Level 3">🚀 Level 3 Product (160-199)</option>
                      <option value="Level 2">💼 Level 2 Placement (120-159)</option>
                      <option value="Level 1">🌱 Level 1 Foundation (80-119)</option>
                      <option value="Not Eligible">⚠️ Not Eligible (&lt; 80)</option>
                    </select>
                  </div>

                  {/* Re-assign Control */}
                  <div className="batch-assign-container">
                    <span className="selected-count-pill">
                      {selectedStudentIds.length} Selected
                    </span>
                    <select
                      value={assignTargetMentor}
                      onChange={(e) => setAssignTargetMentor(e.target.value)}
                      className="filter-select"
                    >
                      {mentors.map(m => (
                        <option key={m.id_number} value={m.id_number}>
                          Reassign to: {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary-btn-sm"
                      onClick={handleAssignSelectedStudents}
                      disabled={assignLoading || selectedStudentIds.length === 0}
                    >
                      {assignLoading ? 'Reassigning...' : 'Reassign Mentees'}
                    </button>
                  </div>
                </div>

                {assignSuccessMsg && (
                  <div className="alert-banner success">
                    ✅ {assignSuccessMsg}
                  </div>
                )}

                {/* Students Table */}
                <div className="admin-table-container">
                  {scoreLoading ? (
                    <div className="table-loading">Loading {selectedMentor.name}'s students...</div>
                  ) : students.length === 0 ? (
                    <div className="empty-state">No students found matching the filters for this mentor.</div>
                  ) : (
                    <table className="score-matrix-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={students.length > 0 && selectedStudentIds.length === students.length}
                              onChange={toggleSelectAll}
                            />
                          </th>
                          <th>Student Info</th>
                          <th>Dept</th>
                          <th>100D</th>
                          <th>Lang</th>
                          <th>GATE</th>
                          <th>Comp</th>
                          <th>Intern</th>
                          <th>Cert</th>
                          <th>Apt</th>
                          <th>Coding</th>
                          <th>CP</th>
                          <th>OSS</th>
                          <th>Month</th>
                          <th>Proj</th>
                          <th>Total Score (250)</th>
                          <th>Readiness Tier</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st) => (
                          <tr key={st.id_number} className={selectedStudentIds.includes(st.id_number) ? 'row-selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedStudentIds.includes(st.id_number)}
                                onChange={() => toggleStudentSelection(st.id_number)}
                              />
                            </td>
                            <td>
                              <div className="student-cell">
                                <strong className="student-name">{st.name}</strong>
                                <span className="student-roll">Roll: {st.id_number} | Reg: {st.register_number}</span>
                              </div>
                            </td>
                            <td>
                              <span className="dept-badge">{st.department}</span>
                            </td>
                            <td className="score-num">{st.scores.hundred_days || 0}</td>
                            <td className="score-num">{st.scores.language || 0}</td>
                            <td className="score-num">{st.scores.gate || 0}</td>
                            <td className="score-num">{st.scores.competition || 0}</td>
                            <td className="score-num">{st.scores.internship || 0}</td>
                            <td className="score-num">{st.scores.certificate || 0}</td>
                            <td className="score-num">{st.scores.aptitude || 0}</td>
                            <td className="score-num">{st.scores.coding_problems || 0}</td>
                            <td className="score-num">{st.scores.cp_rating || 0}</td>
                            <td className="score-num">{st.scores.opensource || 0}</td>
                            <td className="score-num">{st.scores.monthly_coding || 0}</td>
                            <td className="score-num">{st.scores.project || 0}</td>
                            <td>
                              <div className="total-score-pill">
                                <span className="score-val">{st.total_score}</span>
                                <span className="score-max">/ 250</span>
                              </div>
                            </td>
                            <td>
                              <span 
                                className="tier-badge" 
                                style={{ backgroundColor: `${st.readiness_tier.color}22`, color: st.readiness_tier.color, borderColor: st.readiness_tier.color }}
                              >
                                {st.readiness_tier.level}
                              </span>
                            </td>
                            <td>
                              <button
                                className="view-btn-sm"
                                onClick={() => setSelectedStudentForModal(st)}
                              >
                                Scorecard 🔍
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination Controls */}
                {pagination.total_pages > 1 && (
                  <div className="pagination-bar">
                    <span className="page-info">
                      Showing Page {page} of {pagination.total_pages} ({pagination.total} total students in this cohort)
                    </span>
                    <div className="page-buttons">
                      <button 
                        disabled={page === 1} 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="page-btn"
                      >
                        ← Previous
                      </button>
                      <button 
                        disabled={page >= pagination.total_pages} 
                        onClick={() => setPage(p => p + 1)}
                        className="page-btn"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: UPLOADER */}
        {activeTab === 'uploader' && (
          <div className="tab-content">
            <div className="uploader-card">
              <h2>📥 Ingest Monthly Coding Assessment Data</h2>
              <p>Upload the official Department Excel (.xlsx) file containing student assessment marks</p>

              <form onSubmit={handleFileUpload} className="upload-form">
                <div className="form-group">
                  <label>Select Semester:</label>
                  <select value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Assessment Month / Cycle:</label>
                  <input
                    type="text"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder="e.g., September 2026"
                  />
                </div>

                <div className="form-group">
                  <label>Excel File (.xlsx / .xls):</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                  />
                </div>

                <button type="submit" className="primary-btn" disabled={uploadLoading}>
                  {uploadLoading ? '⚡ Processing Assessment Scores...' : 'Upload & Compute Scores'}
                </button>
              </form>

              {uploadLoading && importJob && (
                <div style={{ marginTop: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                    <span>🔄 Ingestion in progress (Job: <code>{importJob.id}</code>)</span>
                    <span>{importJob.processed_rows} / {importJob.total_rows} students</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #3b82f6, #6366f1)', 
                        width: `${importJob.total_rows > 0 ? Math.min(100, Math.round((importJob.processed_rows / importJob.total_rows) * 100)) : 10}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              {uploadStatus && (
                <div className={`upload-status-box ${uploadStatus.error ? 'error' : 'success'}`} style={{ marginTop: '1.5rem' }}>
                  {uploadStatus.error ? (
                    <p>❌ {uploadStatus.error}</p>
                  ) : (
                    <div>
                      <h3>✅ {uploadStatus.message}</h3>
                      <p>Total Processed Rows: <strong>{uploadStatus.summary?.totalRows || 0}</strong></p>
                      <p>Successfully Inserted / Updated: <strong>{uploadStatus.summary?.processed || 0}</strong></p>
                      {uploadStatus.summary?.failed > 0 && (
                        <p style={{ color: '#ef4444' }}>Skipped / Errors: <strong>{uploadStatus.summary.failed}</strong></p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}



        {/* TAB 5: 12-PARAMETER REFERENCE */}
        {activeTab === 'parameters' && (
          <div className="tab-content">
            <div className="parameters-table-container">
              <h2>⚖️ HOPE 12-Parameter Deterministic Scoring System</h2>
              <table className="parameters-table">
                <thead>
                  <tr>
                    <th>Module Name</th>
                    <th>Max Marks</th>
                    <th>Scoring & Tier Resolution Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {parametersList.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td><span className="marks-badge">{p.max} Marks</span></td>
                      <td>{p.strategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: STUDENT DETAILED SCORECARD */}
        {selectedStudentForModal && (
          <div className="modal-backdrop" onClick={() => setSelectedStudentForModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2>🎓 {selectedStudentForModal.name}</h2>
                  <p>
                    Roll: <strong>{selectedStudentForModal.id_number}</strong> | 
                    Reg: <strong>{selectedStudentForModal.register_number}</strong> | 
                    Dept: <strong>{selectedStudentForModal.department}</strong>
                  </p>
                  <p>
                    Assigned Mentor: <strong>{selectedStudentForModal.assigned_mentor_name}</strong>
                  </p>
                </div>
                <button className="close-btn" onClick={() => setSelectedStudentForModal(null)}>✕</button>
              </div>

              <div className="modal-body">
                <div className="scorecard-summary-card">
                  <div className="summary-col">
                    <span className="summary-label">Total Score</span>
                    <span className="summary-val">{selectedStudentForModal.total_score} / 250</span>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">Readiness Level</span>
                    <span 
                      className="tier-badge-large"
                      style={{ 
                        backgroundColor: `${selectedStudentForModal.readiness_tier.color}22`,
                        color: selectedStudentForModal.readiness_tier.color,
                        borderColor: selectedStudentForModal.readiness_tier.color
                      }}
                    >
                      {selectedStudentForModal.readiness_tier.title}
                    </span>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">Modules Completed</span>
                    <span className="summary-val">{selectedStudentForModal.completed_parameters} / 12</span>
                  </div>
                </div>

                <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>12-Parameter Breakdown</h3>
                <div className="param-score-grid">
                  {parametersList.map(p => {
                    const score = selectedStudentForModal.scores[p.id] || 0;
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
                <button className="primary-btn" onClick={() => setSelectedStudentForModal(null)}>
                  Close Scorecard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
