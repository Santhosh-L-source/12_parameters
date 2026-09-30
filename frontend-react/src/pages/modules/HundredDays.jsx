import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const HundredDays = () => {
  const student = getStudent();
  const rollNumber = student?.roll_number || '24CS422';

  const [stats, setStats] = useState({
    hasSubmitted: false,
    program: 'NOT_EVALUATED',
    status: 'PENDING_EVALUATION',
    marks: 0,
    maxMarks: 15,
    verifiedAt: null,
    mentorId: null,
  });

  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [evidenceRes, marksRes] = await Promise.all([
        moduleAPI.getHundredDays(rollNumber),
        moduleAPI.getHundredDaysMarks(rollNumber),
      ]);

      const ev = evidenceRes?.evidence;
      const marks = marksRes?.marks || 0;
      const program = ev?.training_program || marksRes?.program || 'NOT_EVALUATED';

      setEvidence(ev);
      setStats({
        hasSubmitted: !!ev,
        program: program,
        status: ev?.status === 'VERIFIED' || marks > 0 ? 'VERIFIED' : 'PENDING_EVALUATION',
        marks: marks,
        maxMarks: 15,
        verifiedAt: ev?.verified_at || null,
        mentorId: ev?.mentor_id || null,
      });
    } catch (error) {
      console.error('Error loading 100 days data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgramDisplay = (prog) => {
    switch (prog) {
      case 'HOPE_ELITE':
        return { name: 'HOPE Elite Track', marks: 15, color: '#4f46e5', badge: 'Elite Track' };
      case 'HOPE_NON_ELITE':
        return { name: 'HOPE Non-Elite Track', marks: 10, color: '#0284c7', badge: 'Non-Elite Track' };
      case 'PEP':
        return { name: 'PEP Training Program', marks: 5, color: '#059669', badge: 'PEP Track' };
      default:
        return { name: 'Awaiting Mentor Evaluation', marks: 0, color: '#64748b', badge: 'Pending' };
    }
  };

  const currentProgram = getProgramDisplay(stats.program);

  return (
    <div className="competition-page">
      <Header />
      <div className="competition-container">
        <div className="page-header">
          <h1>🎯 100 Days Training Program</h1>
          <p>Institutional 100 Days Placement & Skill Training track evaluated directly by your Faculty Mentor (Max 15 Marks)</p>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem',
          marginBottom: '1.75rem',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '0.4rem',
          }}>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b' }}>
              {stats.marks} <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#64748b' }}>/ {stats.maxMarks}</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Evaluated Marks
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '0.4rem',
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: currentProgram.color }}>
              {currentProgram.name}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Assigned Training Track
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '0.4rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: stats.status === 'VERIFIED' ? '#ecfdf5' : '#fffbeb',
                color: stats.status === 'VERIFIED' ? '#059669' : '#d97706',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}>
                {stats.status === 'VERIFIED' ? '✓ VERIFIED BY MENTOR' : '⏳ PENDING EVALUATION'}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Status
            </div>
          </div>
        </div>

        {/* Mentor Evaluation Notice Banner */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '1.5rem 1.75rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        }}>
          <span style={{ fontSize: '2rem' }}>👨‍🏫</span>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
              Mentor Direct Assessment Parameter
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>
              Marks for the <strong>100 Days Training Program</strong> are directly awarded and managed by your assigned <strong>Faculty Mentor</strong> and Department Placement Coordinator based on official cohort attendance, milestone tests, and track selection. Students are not required to submit manual proofs.
            </p>
          </div>
        </div>

        {/* Current Evaluation Details Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '1.75rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
            📋 Your Training Track & Record
          </h2>

          {stats.status === 'VERIFIED' ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#166534', marginBottom: '0.25rem' }}>
                  {currentProgram.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#15803d' }}>
                  Marks Awarded: <strong>{stats.marks} / 15 Marks</strong>
                  {evidence?.selection_year && ` • Cohort Year: ${evidence.selection_year}`}
                </div>
              </div>
              <div style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}>
                ✓ Evaluated & Approved
              </div>
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              color: '#64748b',
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Evaluation Pending
              </div>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>
                Your Faculty Mentor will update your 100 Days Training track and marks upon completion of the training cycle reviews.
              </p>
            </div>
          )}
        </div>

        {/* Scoring Reference Matrix */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
            📊 100 Days Training Scoring Matrix (Max 15 Marks)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{
              background: '#f8fafc',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #4f46e5',
            }}>
              <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '1rem' }}>
                HOPE Elite Track: 15 Marks
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Selected in HOPE Elite intensive problem solving & tech cohort
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #0284c7',
            }}>
              <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '1rem' }}>
                HOPE Non-Elite Track: 10 Marks
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Selected in standard HOPE placement readiness track
              </div>
            </div>

            <div style={{
              background: '#f8fafc',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #059669',
            }}>
              <div style={{ fontWeight: 700, color: '#059669', fontSize: '1rem' }}>
                PEP Program: 5 Marks
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                Placement Enhancement Program (PEP) foundation training
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HundredDays;
