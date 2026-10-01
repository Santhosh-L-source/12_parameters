import { useState, useEffect } from 'react';
import Header from '../components/Header';
import { mentorAPI, adminAPI, API_BASE_URL } from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  // Active Tab: 'cohorts_3rd', 'cohorts_2nd', 'uploader', 'parameters'
  const [activeTab, setActiveTab] = useState('cohorts_3rd');

  // Selected Mentor for Cohort View (per year)
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

  // Mentor Directory State
  const [mentors3rd, setMentors3rd] = useState([]);
  const [mentors2nd, setMentors2nd] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [assignTargetMentor, setAssignTargetMentor] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState('');

  // Uploader State
  const [uploadFile, setUploadFile] = useState(null);
  const [semester, setSemester] = useState(3);
  const [month, setMonth] = useState('August 2026');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [importJob, setImportJob] = useState(null);

  useEffect(() => {
    loadAllMentors();
  }, []);

  // When active tab or mentor selection changes, reload appropriate data
  useEffect(() => {
    if ((activeTab === 'cohorts_3rd' || activeTab === 'cohorts_2nd') && selectedMentor) {
      loadStudentScores();
    }
  }, [activeTab, selectedMentor, searchTerm, selectedDept, selectedTier, page]);

  // When switching between 3rd Year and 2nd Year tabs
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSelectedMentor(null);
    setSelectedStudentIds([]);
    setSearchTerm('');
    setSelectedTier('ALL');
    setPage(1);

    if (newTab === 'cohorts_3rd') {
      if (mentors3rd.length > 0) setAssignTargetMentor(mentors3rd[0].id_number);
    } else if (newTab === 'cohorts_2nd') {
      if (mentors2nd.length > 0) setAssignTargetMentor(mentors2nd[0].id_number);
    }
  };

  const loadAllMentors = async () => {
    try {
      setMentorsLoading(true);
      const [res3rd, res2nd] = await Promise.all([
        adminAPI.getMentors({ year: 3 }),
        adminAPI.getMentors({ year: 2 })
      ]);

      if (res3rd.success) {
        setMentors3rd(res3rd.mentors || []);
        if (res3rd.mentors.length > 0 && !assignTargetMentor) {
          setAssignTargetMentor(res3rd.mentors[0].id_number);
        }
      }
      if (res2nd.success) {
        setMentors2nd(res2nd.mentors || []);
      }
    } catch (err) {
      console.error('Error loading mentors by year:', err);
    } finally {
      setMentorsLoading(false);
    }
  };

  const loadStudentScores = async () => {
    if (!selectedMentor) return;
    try {
      setScoreLoading(true);
      const currentYear = activeTab === 'cohorts_2nd' ? '2' : '3';
      const params = {
        page,
        limit: 50,
        year: currentYear,
        mentor_id: (selectedMentor.id_number === '__UNASSIGNED__' || selectedMentor.id_number === 'UNASSIGNED') 
          ? 'UNASSIGNED' 
          : selectedMentor.id_number
      };
      if (searchTerm) params.search = searchTerm;
      if (selectedDept !== 'ALL') params.department = selectedDept;
      if (selectedTier !== 'ALL') params.tier = selectedTier;

      const data = await adminAPI.getStudentScores(params);
      if (data.success) {
        setStudents(data.students || []);
        setScoreStats(data.stats || null);
        setPagination(data.pagination || { total: 0, total_pages: 1, limit: 50 });
      }
    } catch (err) {
      console.error('Error loading cohort student scores:', err);
    } finally {
      setScoreLoading(false);
    }
  };

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
                loadAllMentors();
                if (selectedMentor) loadStudentScores();
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
      alert('Please select a target mentor.');
      return;
    }

    try {
      setAssignLoading(true);
      setAssignSuccessMsg('');
      const res = await adminAPI.assignMentor(selectedStudentIds, assignTargetMentor);
      if (res.success) {
        setAssignSuccessMsg(`Successfully reassigned ${selectedStudentIds.length} student(s) to ${res.mentor?.name}!`);
        setSelectedStudentIds([]);
        loadStudentScores();
        loadAllMentors();
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

  const handleAutoAssign = async (targetYear) => {
    const yearLabel = targetYear === 2 ? '2nd Year (2029 Batch)' : '3rd Year (2028 Batch)';
    if (!window.confirm(`Auto-assign all unassigned ${yearLabel} students to their respective department mentors?`)) {
      return;
    }
    try {
      setAssignLoading(true);
      const res = await adminAPI.autoAssignDepartments({ year: targetYear });
      if (res.success) {
        alert(`Auto-assignment for ${yearLabel} completed successfully!`);
        loadAllMentors();
        if (selectedMentor) loadStudentScores();
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

  const handleSelectMentor = (mentor) => {
    setSelectedMentor(mentor);
    setPage(1);
    setSearchTerm('');
    setSelectedTier('ALL');
    setSelectedStudentIds([]);
    // Set default reassign target to first mentor of current year
    const currentYearMentors = activeTab === 'cohorts_2nd' ? mentors2nd : mentors3rd;
    if (currentYearMentors.length > 0) {
      setAssignTargetMentor(currentYearMentors[0].id_number);
    }
  };

  const handleBackToMentors = () => {
    setSelectedMentor(null);
    setSelectedStudentIds([]);
    setStudents([]);
    loadAllMentors();
  };

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

  const total3rdYearMentees = mentors3rd.reduce((sum, m) => sum + (m.assigned_count || 0), 0);
  const total2ndYearMentees = mentors2nd.reduce((sum, m) => sum + (m.assigned_count || 0), 0);

  const currentMentorsList = activeTab === 'cohorts_2nd' ? mentors2nd : mentors3rd;

  return (
    <div className="admin-dashboard">
      <Header />
      <div className="admin-container">
        {/* Top Header */}
        <div className="admin-header">
          <div>
            <h1>⚙️ Admin Control & Academic Center</h1>
            <p>Supervise student readiness scores (250 marks), mentor allocations, and cohort matrices partitioned by academic year</p>
          </div>
        </div>

        {/* Tab Navigation: Dedicated 3rd Year and 2nd Year Tabs */}
        <div className="admin-tabs">
          <button
            className={`tab-btn tab-3rd ${activeTab === 'cohorts_3rd' ? 'active' : ''}`}
            onClick={() => handleTabChange('cohorts_3rd')}
          >
            📙 3rd Year Cohorts (2028 Batch)
            <span className="tab-pill tab-pill-3rd">{total3rdYearMentees.toLocaleString()} Students</span>
          </button>
          <button
            className={`tab-btn tab-2nd ${activeTab === 'cohorts_2nd' ? 'active' : ''}`}
            onClick={() => handleTabChange('cohorts_2nd')}
          >
            📘 2nd Year Cohorts (2029 Batch)
            <span className="tab-pill tab-pill-2nd">{total2ndYearMentees.toLocaleString()} Students</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'uploader' ? 'active' : ''}`}
            onClick={() => handleTabChange('uploader')}
          >
            📥 Batch Score Uploader
          </button>
          <button
            className={`tab-btn ${activeTab === 'parameters' ? 'active' : ''}`}
            onClick={() => handleTabChange('parameters')}
          >
            ⚖️ 12-Parameter Rules (250 Marks)
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB: 3RD YEAR OR 2ND YEAR COHORTS                            */}
        {/* ============================================================ */}
        {(activeTab === 'cohorts_3rd' || activeTab === 'cohorts_2nd') && (
          <div className="tab-content">
            {!selectedMentor ? (
              /* VIEW A: MENTOR DIRECTORY FOR SELECTED YEAR */
              <div>
                <div className="section-header-row">
                  <div>
                    <div className="year-title-badge-wrapper">
                      <span className={`year-hero-badge ${activeTab === 'cohorts_2nd' ? 'hero-year-2' : 'hero-year-3'}`}>
                        {activeTab === 'cohorts_2nd' ? '📘 2nd Year · 2029 Batch' : '📙 3rd Year · 2028 Batch'}
                      </span>
                      <h2>
                        {activeTab === 'cohorts_2nd' ? '2nd Year Faculty Mentors & Student Cohorts' : '3rd Year Faculty Mentors & Student Cohorts'}
                      </h2>
                    </div>
                    <p>Click on any faculty mentor card below to inspect their assigned mentees, student scores, and cohort performance matrix</p>
                  </div>
                  <button 
                    className="primary-btn"
                    onClick={() => handleAutoAssign(activeTab === 'cohorts_2nd' ? 2 : 3)}
                    disabled={assignLoading}
                  >
                    ⚡ Auto-Assign {activeTab === 'cohorts_2nd' ? '2nd Year' : '3rd Year'} Students by Dept
                  </button>
                </div>

                {mentorsLoading ? (
                  <div className="table-loading">Loading faculty mentors...</div>
                ) : (
                  <div className="mentors-grid">
                    {currentMentorsList.map((m) => (
                      <div 
                        key={m.id_number} 
                        className={`mentor-card clickable-mentor-card ${activeTab === 'cohorts_2nd' ? 'card-year-2' : 'card-year-3'}`}
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
                            <span className="load-label">
                              {activeTab === 'cohorts_2nd' ? '2nd Yr Mentees' : '3rd Yr Mentees'}
                            </span>
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
                            View {activeTab === 'cohorts_2nd' ? '2nd Yr' : '3rd Yr'} Cohort ({m.assigned_count}) →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* VIEW B: DEDICATED MENTOR COHORT MATRIX */
              <div className="cohort-detail-view">
                {/* Cohort Header Banner */}
                <div className={`cohort-header-banner ${activeTab === 'cohorts_2nd' ? 'banner-year-2' : 'banner-year-3'}`}>
                  <button 
                    className="back-btn"
                    onClick={handleBackToMentors}
                  >
                    ← Back to {activeTab === 'cohorts_2nd' ? '2nd Year' : '3rd Year'} Mentors
                  </button>
                  <div className="cohort-header-info">
                    <div className="cohort-avatar">👨‍🏫</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`year-pill ${activeTab === 'cohorts_2nd' ? 'year-2' : 'year-3'}`}>
                          {activeTab === 'cohorts_2nd' ? '2nd Year (2029 Batch)' : '3rd Year (2028 Batch)'}
                        </span>
                      </div>
                      <h2>{selectedMentor.name} — Student Cohort</h2>
                      <p>
                        <strong>Department:</strong> {selectedMentor.department || 'General'} &nbsp;|&nbsp; 
                        <strong>Mentor ID:</strong> <code>{selectedMentor.id_number}</code> &nbsp;|&nbsp; 
                        <strong>Total Cohort Mentees:</strong> {pagination.total} students
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
                  <div className="stat-card orange">
                    <div className="stat-icon">📊</div>
                    <div className="stat-info">
                      <span className="stat-value">{scoreStats?.avg_score || 0}</span>
                      <span className="stat-label">Average Score</span>
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
                      {currentMentorsList.map(m => (
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
                    <div className="table-loading">Loading {selectedMentor.name}'s cohort students...</div>
                  ) : students.length === 0 ? (
                    <div className="empty-state">No students found matching the filters for this mentor cohort.</div>
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
                          <th>Academic Year</th>
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
                              <span className={`year-pill ${st.year === 2 ? 'year-2' : 'year-3'}`}>
                                {st.short_batch_label || (st.year === 2 ? '2nd Year (2029)' : '3rd Year (2028)')}
                              </span>
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

        {/* ============================================================ */}
        {/* TAB: BATCH SCORE UPLOADER                                    */}
        {/* ============================================================ */}
        {activeTab === 'uploader' && (
          <div className="tab-content">
            <div className="uploader-card">
              <h2>📥 Ingest Monthly Coding Assessment Data</h2>
              <p>Upload the official Department Excel (.xlsx) file containing student assessment marks for 2nd or 3rd year</p>

              <form onSubmit={handleFileUpload} className="upload-form">
                <div className="form-group">
                  <label>Select Semester:</label>
                  <select value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                    <option value={3}>Semester 3 (2nd Year · 2029 Batch)</option>
                    <option value={5}>Semester 5 (3rd Year · 2028 Batch)</option>
                    {[1, 2, 4, 6, 7, 8].map(s => (
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
                    placeholder="e.g., August 2026 / September 2026"
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

        {/* ============================================================ */}
        {/* TAB: 12-PARAMETER REFERENCE                                  */}
        {/* ============================================================ */}
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

        {/* ============================================================ */}
        {/* MODAL: STUDENT DETAILED SCORECARD                            */}
        {/* ============================================================ */}
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
                    Batch: <span className={`year-pill ${selectedStudentForModal.year === 2 ? 'year-2' : 'year-3'}`} style={{ display: 'inline-block', margin: '2px 0' }}>
                      {selectedStudentForModal.batch_label || (selectedStudentForModal.year === 2 ? '2nd Year (2029 Batch)' : '3rd Year (2028 Batch)')}
                    </span> | Assigned Mentor: <strong>{selectedStudentForModal.assigned_mentor_name}</strong>
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
