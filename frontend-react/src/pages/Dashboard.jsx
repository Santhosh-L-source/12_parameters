import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI, studentAPI } from '../services/api';
import { getStudent } from '../utils/auth';
import './Dashboard.css';

const TIERS = [
  { name: 'Starter', min: 0, max: 79, color: '#64748b', badge: '🌱 Starter' },
  { name: 'Level 1', min: 80, max: 119, color: '#16a34a', badge: '🌿 Level 1' },
  { name: 'Level 2', min: 120, max: 159, color: '#0284c7', badge: '⚡ Level 2' },
  { name: 'Level 3', min: 160, max: 199, color: '#7c3aed', badge: '🔥 Level 3' },
  { name: 'Elite Tier', min: 200, max: 250, color: '#d97706', badge: '👑 Elite' },
];

const PARAM_TO_MODULE = {
  'hundred_days': 'hundred-days',
  '100_days': 'hundred-days',
  'hundred-days': 'hundred-days',
  'language': 'language',
  'gate': 'gate',
  'gate_exam': 'gate',
  'competition': 'competition',
  'internship': 'internship',
  'certificate': 'certificate',
  'aptitude': 'aptitude-communication',
  'aptitude_communication': 'aptitude-communication',
  'aptitude-communication': 'aptitude-communication',
  'coding_problems': 'coding-problems',
  'coding-problems': 'coding-problems',
  'cp_rating': 'cp-rating',
  'cp-rating': 'cp-rating',
  'open_source': 'open-source',
  'open-source': 'open-source',
  'opensource': 'open-source',
  'monthly_coding': 'monthly-coding',
  'monthly-coding': 'monthly-coding',
  'month_score': 'monthly-coding',
  'project': 'project-pub-patent',
  'project_pub_patent': 'project-pub-patent',
  'project-pub-patent': 'project-pub-patent',
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const student = getStudent();
  const [totalMarks, setTotalMarks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState([
    {
      id: 'hundred-days',
      name: 'Hundred Days Training',
      icon: '🎯',
      maxMarks: 15,
      color: '#dbeafe',
      desc: 'PEP, HOPE foundation programs',
      page: '/modules/hundred-days',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'language',
      name: 'Foreign Language',
      icon: '🌍',
      maxMarks: 15,
      color: '#fef3c7',
      desc: 'A1, A2, B1 language proficiencies',
      page: '/modules/language',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'gate',
      name: 'GATE & Higher Studies',
      icon: '📚',
      maxMarks: 25,
      color: '#fce7f3',
      desc: 'Mock tests, diagnostics & scores',
      page: '/modules/gate',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'competition',
      name: 'Competitions & Hackathons',
      icon: '🏆',
      maxMarks: 20,
      color: '#d1fae5',
      desc: 'Hackathons, coding contests & awards',
      page: '/modules/competition',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'internship',
      name: 'Internship & Startup',
      icon: '💼',
      maxMarks: 20,
      color: '#e0e7ff',
      desc: 'Industry roles, offers & startup builds',
      page: '/modules/internship',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'certificate',
      name: 'Industry & Academic Certs',
      icon: '🎓',
      maxMarks: 20,
      color: '#fef3c7',
      desc: 'AWS, Google, NPTEL & Coursera',
      page: '/modules/certificate',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'aptitude-communication',
      name: 'Aptitude & Communication',
      icon: '🗣️',
      maxMarks: 20,
      color: '#ede9fe',
      desc: 'Mock assessments & public speaking',
      page: '/modules/aptitude',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'coding-problems',
      name: 'Coding Problems',
      icon: '💻',
      maxMarks: 25,
      color: '#e0f2fe',
      desc: 'LeetCode, Codeforces problem counts',
      page: '/modules/coding-problems',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'cp-rating',
      name: 'Competitive Rating',
      icon: '⭐',
      maxMarks: 20,
      color: '#fef9c3',
      desc: 'Contest ratings & active badges',
      page: '/modules/cp-rating',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'open-source',
      name: 'Open Source Contributions',
      icon: '🔓',
      maxMarks: 20,
      color: '#dcfce7',
      desc: 'GitHub PRs, programs & maintainer',
      page: '/modules/open-source',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'monthly-coding',
      name: 'Monthly Coding Assessment',
      icon: '📅',
      maxMarks: 20,
      color: '#fae8ff',
      desc: 'Department monthly test results',
      page: '/modules/monthly-coding',
      currentMarks: 0,
      status: 'not-started',
    },
    {
      id: 'project-pub-patent',
      name: 'Project / Publication / Patent',
      icon: '🔬',
      maxMarks: 30,
      color: '#ffe4e6',
      desc: 'Research publications, prototypes, patents',
      page: '/modules/project',
      currentMarks: 0,
      status: 'not-started',
    },
  ]);

  useEffect(() => {
    loadModuleMarks();
  }, []);

  const loadModuleMarks = async () => {
    const studentObj = getStudent();
    const rollNumber = studentObj?.roll_number || studentObj?.id_number || studentObj?.student_id;
    if (!rollNumber) {
      setLoading(false);
      return;
    }

    const updatedModules = [...modules];
    const marksMap = {};

    try {
      // 1. First fetch master scores directly from scores database table
      try {
        const scoresRes = await studentAPI.getScores();
        if (scoresRes?.success && Array.isArray(scoresRes.scores)) {
          scoresRes.scores.forEach((s) => {
            const paramKey = (s.parameter || s.parameter_id || '').toLowerCase().trim();
            const modId = PARAM_TO_MODULE[paramKey] || paramKey;
            const mVal = parseFloat(s.marks || 0);
            if (mVal > 0) {
              marksMap[modId] = Math.max(marksMap[modId] || 0, mVal);
            }
          });
        }
      } catch (scoreErr) {
        console.warn('Student score overview fallback:', scoreErr);
      }

      // 2. Query individual module endpoints for missing/additional verification
      const apiMap = {
        'hundred-days': moduleAPI.getHundredDaysMarks,
        'language': moduleAPI.getLanguageMarks,
        'gate': moduleAPI.getGateMarks,
        'competition': moduleAPI.getCompetitionMarks,
        'internship': moduleAPI.getInternshipMarks,
        'certificate': moduleAPI.getCertificateMarks,
        'aptitude-communication': moduleAPI.getAptitudeMarks,
        'coding-problems': moduleAPI.getCodingProblemsMarks,
        'cp-rating': moduleAPI.getCPRatingMarks,
        'open-source': moduleAPI.getOpenSourceMarks,
        'monthly-coding': moduleAPI.getMonthlyCodingMarks,
        'project-pub-patent': moduleAPI.getProjectPubPatentMarks,
      };

      const pendingModules = updatedModules.filter((m) => !marksMap[m.id]);
      if (pendingModules.length > 0) {
        const results = await Promise.allSettled(
          pendingModules.map(async (mod) => {
            const fetcher = apiMap[mod.id];
            if (fetcher) {
              const data = await fetcher(rollNumber);
              const marks = typeof data?.marks === 'number' ? data.marks : (typeof data === 'number' ? data : 0);
              return { id: mod.id, marks };
            }
            return { id: mod.id, marks: 0 };
          })
        );

        results.forEach((res) => {
          if (res.status === 'fulfilled' && res.value.marks > 0) {
            marksMap[res.value.id] = Math.max(marksMap[res.value.id] || 0, res.value.marks);
          }
        });
      }

      let total = 0;
      updatedModules.forEach((m) => {
        const marks = marksMap[m.id] || 0;
        m.currentMarks = marks;
        m.status = marks > 0 ? 'verified' : 'not-started';
        total += marks;
      });

      setModules(updatedModules);
      setTotalMarks(total);
    } catch (err) {
      console.error('Error loading module marks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Current tier calculation
  const currentTier = TIERS.slice().reverse().find((t) => totalMarks >= t.min) || TIERS[0];
  const nextTierIndex = TIERS.findIndex((t) => t.name === currentTier.name) + 1;
  const nextTier = nextTierIndex < TIERS.length ? TIERS[nextTierIndex] : null;
  const marksToNext = nextTier ? nextTier.min - totalMarks : 0;
  const progressPercent = Math.min(100, Math.round((totalMarks / 250) * 100));
  const activeCount = modules.filter((m) => m.currentMarks > 0).length;

  return (
    <div className="dashboard-page">
      <Header />
      <div className="container">
        
        {/* Warm Humanized Hero Welcome Banner */}
        <div className="hero-profile-card">
          <div className="hero-left">
            <div className="welcome-tag">
              <span>👋</span> {getGreeting()}, {student?.name?.split(' ')[0] || 'Student'}!
            </div>
            <h1 className="student-full-name">{student?.name || 'Achievement Dashboard'}</h1>
            <div className="student-meta-chips">
              <span className="meta-chip">
                <strong>ID:</strong> {student?.roll_number || student?.id_number || '-'}
              </span>
              <span className="meta-chip">
                <strong>Dept:</strong> {student?.department || 'Engineering'}
              </span>
              <span className="meta-chip">
                <strong>Tier:</strong> {currentTier.badge}
              </span>
            </div>
          </div>

          <div className="hero-right">
            <div className="score-hero-box">
              <span className="score-hero-label">Total Achievement</span>
              <div className="score-hero-number">{totalMarks}</div>
              <div className="score-hero-cap">out of 250 Marks</div>
            </div>
          </div>
        </div>

        {/* Modules Section */}
        <div className="modules-section">
          <div className="modules-section-header">
            <div>
              <h2>Achievement Modules ({modules.length})</h2>
              <p className="section-subtitle">
                Explore each track to view requirements, submit verified proofs, and boost your aggregate score.
              </p>
            </div>
          </div>

          <div className="modules-grid">
            {modules.map((module) => {
              const modulePercent = Math.min(100, Math.round((module.currentMarks / module.maxMarks) * 100));
              return (
                <div
                  key={module.id}
                  className="module-card"
                  onClick={() => navigate(module.page)}
                >
                  <div className="module-card-top">
                    <div
                      className="module-icon-box"
                      style={{ backgroundColor: module.color }}
                    >
                      <span className="module-icon-emoji">{module.icon}</span>
                    </div>
                    <div className="module-marks-pill">
                      <span className="marks-current">{module.currentMarks}</span>
                      <span className="marks-sep">/</span>
                      <span className="marks-max">{module.maxMarks}</span>
                    </div>
                  </div>

                  <div className="module-card-body">
                    <h3 className="module-title">{module.name}</h3>
                    <p className="module-desc">{module.desc}</p>
                    
                    {/* Micro Progress Bar */}
                    <div className="module-micro-progress">
                      <div
                        className="micro-fill"
                        style={{
                          width: `${modulePercent}%`,
                          backgroundColor: module.currentMarks > 0 ? '#10b981' : '#e2e8f0',
                        }}
                      />
                    </div>
                  </div>

                  <div className="module-card-footer">
                    <span className={`status-pill ${module.status}`}>
                      {module.status === 'verified' ? '✓ Verified Marks' : 'Not Started'}
                    </span>
                    <span className="action-hint">
                      Open Module <span className="arrow-glyph">→</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
