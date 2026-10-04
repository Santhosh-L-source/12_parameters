import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorAPI } from '../../services/api';
import Header from '../../components/Header';
import './ReviewQueue.css';

const HundredDaysReview = () => {
  const navigate = useNavigate();

  // Active Tab: 'cohort_matrix' or 'pending_queue'
  const [activeTab, setActiveTab] = useState('cohort_matrix');

  // Cohort Grading State
  const [cohortStudents, setCohortStudents] = useState([]);
  const [cohortLoading, setCohortLoading] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('ALL');
  const [evaluatingStudentId, setEvaluatingStudentId] = useState(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Evidence Review Queue State
  const [evidence, setEvidence] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Global Toast / Message
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadCohortStudents();
    loadPendingEvidence();
  }, []);

  const loadCohortStudents = async () => {
    try {
      setCohortLoading(true);
      const res = await mentorAPI.getHundredDaysCohort();
      if (res.success) {
        setCohortStudents(res.students || []);
      }
    } catch (err) {
      console.error('Error loading cohort students:', err);
      setMessage({ text: 'Failed to load cohort students for 100 Days Training', type: 'error' });
    } finally {
      setCohortLoading(false);
    }
  };

  const loadPendingEvidence = async () => {
    try {
      setQueueLoading(true);
      const result = await mentorAPI.getPendingHundredDays();
      setEvidence(result.evidence || []);
    } catch (error) {
      console.error('Error loading pending evidence:', error);
    } finally {
      setQueueLoading(false);
    }
  };

  // Quick Single Student Grade Change
  const handleSetStudentGrade = async (studentId, trainingProgram) => {
    try {
      setEvaluatingStudentId(studentId);
      setMessage({ text: '', type: '' });

      const res = await mentorAPI.evaluateHundredDays({
        student_id: studentId,
        training_program: trainingProgram
      });

      if (res.success) {
        const marksMap = { 'HOPE_ELITE': 15, 'HOPE_NON_ELITE': 10, 'PEP': 5, 'NOT_SELECTED': 0 };
        const newMarks = marksMap[trainingProgram] || 0;

        // Optimistically update cohort list in local state
        setCohortStudents(prev => prev.map(s => {
          if (s.id_number === studentId || s.register_number === studentId) {
            return {
              ...s,
              training_program: trainingProgram,
              marks: newMarks,
              status: newMarks > 0 ? 'VERIFIED' : 'NOT_SELECTED'
            };
          }
          return s;
        }));

        setMessage({
          text: `✅ Updated ${studentId} to ${getProgramLabel(trainingProgram)} (${newMarks}/15 Marks)`,
          type: 'success'
        });
      } else {
        setMessage({ text: res.message || 'Failed to update student grade', type: 'error' });
      }
    } catch (err) {
      console.error('Grade evaluation error:', err);
      setMessage({ text: err.message || 'Error updating student grade', type: 'error' });
    } finally {
      setEvaluatingStudentId(null);
    }
  };

  // Bulk Apply Grade to All Selected Students
  const handleBulkApplyGrade = async (trainingProgram) => {
    if (selectedStudentIds.length === 0) {
      setMessage({ text: 'Please select at least one student first', type: 'error' });
      return;
    }

    const marksMap = { 'HOPE_ELITE': 15, 'HOPE_NON_ELITE': 10, 'PEP': 5, 'NOT_SELECTED': 0 };
    const targetMarks = marksMap[trainingProgram] || 0;

    try {
      setBulkProcessing(true);
      setMessage({ text: '', type: '' });

      const res = await mentorAPI.batchEvaluateHundredDays({
        student_ids: selectedStudentIds,
        training_program: trainingProgram
      });

      if (res.success) {
        setCohortStudents(prev => prev.map(s => {
          if (selectedStudentIds.includes(s.id_number)) {
            return {
              ...s,
              training_program: trainingProgram,
              marks: targetMarks,
              status: targetMarks > 0 ? 'VERIFIED' : 'NOT_SELECTED'
            };
          }
          return s;
        }));

        setMessage({
          text: `🌟 Successfully updated ${selectedStudentIds.length} students to ${getProgramLabel(trainingProgram)} (${targetMarks} Marks)!`,
          type: 'success'
        });
        setSelectedStudentIds([]);
      } else {
        setMessage({ text: res.message || 'Bulk evaluation failed', type: 'error' });
      }
    } catch (err) {
      console.error('Bulk evaluate error:', err);
      setMessage({ text: err.message || 'Error updating batch grades', type: 'error' });
    } finally {
      setBulkProcessing(false);
    }
  };

  // Checkbox handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedStudentIds(filteredStudents.map(s => s.id_number));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleToggleStudent = (id) => {
    setSelectedStudentIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Proof Verification Handlers
  const handleVerifyEvidence = async (id, action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    try {
      setProcessing(id);
      await mentorAPI.verifyHundredDays(
        id,
        action,
        action === 'REJECTED' ? rejectionReason : null
      );

      setMessage({
        text: `Evidence ${action.toLowerCase()} successfully!`,
        type: 'success'
      });

      setSelectedEvidence(null);
      setRejectionReason('');
      await loadPendingEvidence();
      await loadCohortStudents();
    } catch (error) {
      console.error('Error verifying evidence:', error);
      setMessage({
        text: error.message || 'Failed to verify evidence',
        type: 'error'
      });
    } finally {
      setProcessing(null);
    }
  };

  const getProgramLabel = (program) => {
    const labels = {
      'HOPE_ELITE': 'HOPE Elite (15 Marks)',
      'HOPE_NON_ELITE': 'HOPE (10 Marks)',
      'PEP': 'PEP (5 Marks)',
      'NOT_SELECTED': 'None / 0 Marks'
    };
    return labels[program] || program || 'Not Graded';
  };

  // Filtered Students
  const filteredStudents = cohortStudents.filter(s => {
    const matchesSearch = !searchTerm.trim() || 
      (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.id_number && s.id_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.register_number && s.register_number.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTier === 'HOPE_ELITE') return s.training_program === 'HOPE_ELITE';
    if (filterTier === 'HOPE_NON_ELITE') return s.training_program === 'HOPE_NON_ELITE';
    if (filterTier === 'PEP') return s.training_program === 'PEP';
    if (filterTier === 'NOT_SELECTED') return s.training_program === 'NOT_SELECTED' || !s.training_program || Number(s.marks) === 0;

    return true;
  });

  // Calculate Summary Stats
  const countElite = cohortStudents.filter(s => s.training_program === 'HOPE_ELITE' || Number(s.marks) === 15).length;
  const countHope = cohortStudents.filter(s => s.training_program === 'HOPE_NON_ELITE' || Number(s.marks) === 10).length;
  const countPep = cohortStudents.filter(s => s.training_program === 'PEP' || Number(s.marks) === 5).length;
  const countNone = cohortStudents.length - countElite - countHope - countPep;

  return (
    <div className="review-queue">
      <Header />
      <div className="container">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate('/mentor')}>
              ← Back to Dashboard
            </button>
            <h1>💯 100 Days Training - Cohort Grading & Verification</h1>
            <p className="subtitle">
              Evaluate and assign 100 Days Training milestone marks (HOPE Elite: 15m, HOPE: 10m, PEP: 5m) for your assigned cohort
            </p>
          </div>
        </div>

        {/* Global Alert Message */}
        {message.text && (
          <div 
            className={`message ${message.type}`} 
            style={{
              padding: '14px 18px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: message.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${message.type === 'success' ? '#a7f3d0' : '#fecaca'}`
            }}
          >
            <span>{message.text}</span>
            <button 
              onClick={() => setMessage({ text: '', type: '' })} 
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Primary Tabs */}
        <div className="cohort-tabs">
          <button 
            className={`cohort-tab-btn ${activeTab === 'cohort_matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('cohort_matrix')}
          >
            <span>🎯 Cohort Direct Grading Matrix</span>
            <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
              {cohortStudents.length} Students
            </span>
          </button>
          <button 
            className={`cohort-tab-btn ${activeTab === 'pending_queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending_queue')}
          >
            <span>📥 Student Proof Review Queue</span>
            {evidence.length > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                {evidence.length} Pending
              </span>
            )}
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: COHORT DIRECT GRADING MATRIX                          */}
        {/* ============================================================ */}
        {activeTab === 'cohort_matrix' && (
          <div>
            {/* Stat Ribbon */}
            <div className="cohort-stat-ribbon">
              <div className="cohort-stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                <span className="cohort-stat-title" style={{ color: '#047857' }}>🌟 HOPE Elite (15 Marks)</span>
                <span className="cohort-stat-val" style={{ color: '#047857' }}>{countElite}</span>
                <span className="cohort-stat-sub">Top Tier Milestone</span>
              </div>
              <div className="cohort-stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
                <span className="cohort-stat-title" style={{ color: '#1d4ed8' }}>🎯 HOPE (10 Marks)</span>
                <span className="cohort-stat-val" style={{ color: '#1d4ed8' }}>{countHope}</span>
                <span className="cohort-stat-sub">Intermediate Milestone</span>
              </div>
              <div className="cohort-stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <span className="cohort-stat-title" style={{ color: '#b45309' }}>⚡ PEP (5 Marks)</span>
                <span className="cohort-stat-val" style={{ color: '#b45309' }}>{countPep}</span>
                <span className="cohort-stat-sub">Foundation Milestone</span>
              </div>
              <div className="cohort-stat-card" style={{ borderLeft: '4px solid #94a3b8' }}>
                <span className="cohort-stat-title">⚪ Not Graded / 0m</span>
                <span className="cohort-stat-val" style={{ color: '#64748b' }}>{countNone}</span>
                <span className="cohort-stat-sub">Pending Evaluation</span>
              </div>
              <div className="cohort-stat-card" style={{ borderLeft: '4px solid #4f46e5' }}>
                <span className="cohort-stat-title" style={{ color: '#4338ca' }}>👥 Total Mentees</span>
                <span className="cohort-stat-val" style={{ color: '#4338ca' }}>{cohortStudents.length}</span>
                <span className="cohort-stat-sub">In Your Assigned Cohort</span>
              </div>
            </div>

            {/* Bulk Actions Toolbar */}
            <div className="bulk-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                  <input 
                    type="checkbox"
                    checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                    onChange={handleToggleSelectAll}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4f46e5' }}
                  />
                  <span>Select All ({selectedStudentIds.length} Selected)</span>
                </label>
              </div>

              <div className="bulk-actions-group">
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginRight: '4px' }}>
                  Bulk Action:
                </span>
                <button 
                  className="bulk-btn bulk-btn-elite"
                  disabled={selectedStudentIds.length === 0 || bulkProcessing}
                  onClick={() => handleBulkApplyGrade('HOPE_ELITE')}
                >
                  <span>🌟</span> Set HOPE Elite (15m)
                </button>
                <button 
                  className="bulk-btn bulk-btn-hope"
                  disabled={selectedStudentIds.length === 0 || bulkProcessing}
                  onClick={() => handleBulkApplyGrade('HOPE_NON_ELITE')}
                >
                  <span>🎯</span> Set HOPE (10m)
                </button>
                <button 
                  className="bulk-btn bulk-btn-pep"
                  disabled={selectedStudentIds.length === 0 || bulkProcessing}
                  onClick={() => handleBulkApplyGrade('PEP')}
                >
                  <span>⚡</span> Set PEP (5m)
                </button>
                <button 
                  className="bulk-btn bulk-btn-none"
                  disabled={selectedStudentIds.length === 0 || bulkProcessing}
                  onClick={() => handleBulkApplyGrade('NOT_SELECTED')}
                >
                  <span>✕</span> Reset (0m)
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <input 
                  type="text"
                  placeholder="🔍 Search student by name, roll number, register number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ minWidth: '180px' }}>
                <select
                  value={filterTier}
                  onChange={(e) => setFilterTier(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#ffffff',
                    fontWeight: 600,
                    color: '#334155'
                  }}
                >
                  <option value="ALL">All Tiers ({cohortStudents.length})</option>
                  <option value="HOPE_ELITE">🌟 HOPE Elite ({countElite})</option>
                  <option value="HOPE_NON_ELITE">🎯 HOPE ({countHope})</option>
                  <option value="PEP">⚡ PEP ({countPep})</option>
                  <option value="NOT_SELECTED">⚪ Not Graded ({countNone})</option>
                </select>
              </div>
            </div>

            {/* Student Grading Matrix Table */}
            {cohortLoading ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                <div className="spinner-border text-primary" role="status" style={{ marginBottom: '12px' }}></div>
                <p>Loading assigned cohort students...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="empty-state" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px' }}>
                <div className="empty-icon">🔍</div>
                <h3>No Students Found</h3>
                <p>No students match your filter or search criteria</p>
              </div>
            ) : (
              <div className="matrix-table-container">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th style={{ width: '130px' }}>Roll Number</th>
                      <th style={{ width: '140px' }}>Register Number</th>
                      <th>Student Name</th>
                      <th style={{ width: '100px' }}>Department</th>
                      <th style={{ width: '380px' }}>100 Days Training Evaluation</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Marks Allotted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((st) => {
                      const isSelected = selectedStudentIds.includes(st.id_number);
                      const isCurrentUpdating = evaluatingStudentId === st.id_number;
                      const currentProgram = st.training_program || 'NOT_SELECTED';
                      const currentMarks = Number(st.marks) || 0;

                      return (
                        <tr key={st.id_number} className={isSelected ? 'row-selected' : ''}>
                          <td>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStudent(st.id_number)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4f46e5' }}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: '#1e293b' }}>
                            {(st.id_number && !/^\d{1,4}$/.test(String(st.id_number).trim())) ? st.id_number : (st.register_number || st.id_number || '—')}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                            {st.register_number || '—'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            {st.name}
                          </td>
                          <td>
                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                              {st.department}
                            </span>
                          </td>
                          <td>
                            {/* Interactive Quick Grading Radio Pills */}
                            <div className="tier-pills-container">
                              <button
                                type="button"
                                className={`tier-pill-btn ${currentProgram === 'HOPE_ELITE' || currentMarks === 15 ? 'active-elite' : ''}`}
                                disabled={isCurrentUpdating || bulkProcessing}
                                onClick={() => handleSetStudentGrade(st.id_number, 'HOPE_ELITE')}
                                title="Allot 15 Marks for HOPE Elite"
                              >
                                <span>🌟</span> HOPE Elite (15m)
                              </button>

                              <button
                                type="button"
                                className={`tier-pill-btn ${currentProgram === 'HOPE_NON_ELITE' || currentMarks === 10 ? 'active-hope' : ''}`}
                                disabled={isCurrentUpdating || bulkProcessing}
                                onClick={() => handleSetStudentGrade(st.id_number, 'HOPE_NON_ELITE')}
                                title="Allot 10 Marks for HOPE Non-Elite"
                              >
                                <span>🎯</span> HOPE (10m)
                              </button>

                              <button
                                type="button"
                                className={`tier-pill-btn ${currentProgram === 'PEP' || currentMarks === 5 ? 'active-pep' : ''}`}
                                disabled={isCurrentUpdating || bulkProcessing}
                                onClick={() => handleSetStudentGrade(st.id_number, 'PEP')}
                                title="Allot 5 Marks for PEP"
                              >
                                <span>⚡</span> PEP (5m)
                              </button>

                              <button
                                type="button"
                                className={`tier-pill-btn ${(currentProgram === 'NOT_SELECTED' && currentMarks === 0) ? 'active-none' : ''}`}
                                disabled={isCurrentUpdating || bulkProcessing}
                                onClick={() => handleSetStudentGrade(st.id_number, 'NOT_SELECTED')}
                                title="Reset to 0 Marks"
                              >
                                ✕ 0m
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isCurrentUpdating ? (
                              <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>Saving...</span>
                            ) : (
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                backgroundColor: currentMarks === 15 ? '#ecfdf5' : currentMarks === 10 ? '#eff6ff' : currentMarks === 5 ? '#fffbeb' : '#f8fafc',
                                color: currentMarks === 15 ? '#047857' : currentMarks === 10 ? '#1d4ed8' : currentMarks === 5 ? '#b45309' : '#94a3b8',
                                border: `1px solid ${currentMarks === 15 ? '#a7f3d0' : currentMarks === 10 ? '#bfdbfe' : currentMarks === 5 ? '#fde68a' : '#e2e8f0'}`
                              }}>
                                {currentMarks} / 15
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: STUDENT PROOF REVIEW QUEUE                            */}
        {/* ============================================================ */}
        {activeTab === 'pending_queue' && (
          <div>
            {queueLoading ? (
              <div className="loading">Loading pending queue...</div>
            ) : evidence.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✓</div>
                <h3>All Caught Up!</h3>
                <p>No student-submitted proof documents waiting in the review queue.</p>
                <p style={{ marginTop: '8px', color: '#6366f1', fontWeight: 600 }}>
                  👉 Use the "Cohort Direct Grading Matrix" tab to directly award marks to your students.
                </p>
              </div>
            ) : (
              <div className="evidence-list">
                {evidence.map((item) => (
                  <div key={item.id} className="evidence-item">
                    <div className="evidence-header">
                      <div className="student-info">
                        <h3>{item.student_name}</h3>
                        <span className="student-id">{item.student_id}</span>
                        <span className="department">{item.department}</span>
                      </div>
                      <div className="submission-date">
                        Submitted: {new Date(item.submitted_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="evidence-details">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="label">Training Program:</span>
                          <span className="value highlight">
                            {getProgramLabel(item.training_program)}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Marks if Verified:</span>
                          <span className="value marks">
                            {item.training_program === 'HOPE_ELITE' ? 15 : item.training_program === 'HOPE_NON_ELITE' ? 10 : item.training_program === 'PEP' ? 5 : 0} / 15
                          </span>
                        </div>
                        {item.selection_year && (
                          <div className="detail-item">
                            <span className="label">Selection Year:</span>
                            <span className="value">{item.selection_year}</span>
                          </div>
                        )}
                        {item.selection_letter_url && (
                          <div className="detail-item full-width">
                            <span className="label">Selection Letter:</span>
                            <a
                              href={item.selection_letter_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link"
                            >
                              View Document →
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedEvidence === item.id ? (
                      <div className="verification-panel">
                        <div className="form-group">
                          <label htmlFor={`rejection-${item.id}`}>
                            Rejection Reason (required if rejecting):
                          </label>
                          <textarea
                            id={`rejection-${item.id}`}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Explain why this evidence is being rejected..."
                            rows="3"
                          />
                        </div>
                        <div className="action-buttons">
                          <button
                            className="btn btn-verify"
                            onClick={() => handleVerifyEvidence(item.id, 'VERIFIED')}
                            disabled={processing === item.id}
                          >
                            {processing === item.id ? 'Processing...' : '✓ Verify & Award Marks'}
                          </button>
                          <button
                            className="btn btn-reject"
                            onClick={() => handleVerifyEvidence(item.id, 'REJECTED')}
                            disabled={processing === item.id || !rejectionReason.trim()}
                          >
                            {processing === item.id ? 'Processing...' : '✗ Reject'}
                          </button>
                          <button
                            className="btn btn-cancel"
                            onClick={() => {
                              setSelectedEvidence(null);
                              setRejectionReason('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="quick-actions">
                        <button
                          className="btn btn-review"
                          onClick={() => setSelectedEvidence(item.id)}
                        >
                          Review Submission →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HundredDaysReview;

