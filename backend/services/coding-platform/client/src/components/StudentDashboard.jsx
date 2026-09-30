import { useState, useCallback, useEffect } from 'react';
import { Search, Code2, Database, Trophy, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PlatformRow from './PlatformRow';
import EvidenceTable from './EvidenceTable';
import MarksDisplay from './MarksDisplay';
import { getStudentEvidence, refetchEvidence, getVerificationPlatforms } from '../api';
import { useAuth } from '../context/AuthContext';

const PLATFORMS = [
  { value: 'LEETCODE',       label: 'LeetCode',       abbr: 'LC', cls: 'leetcode',       placeholder: 'https://leetcode.com/u/username' },
  { value: 'CODEFORCES',     label: 'Codeforces',     abbr: 'CF', cls: 'codeforces',     placeholder: 'https://codeforces.com/profile/username' },
  { value: 'GEEKSFORGEEKS',  label: 'GeeksforGeeks',  abbr: 'GG', cls: 'geeksforgeeks',  placeholder: 'https://www.geeksforgeeks.org/user/username' },
  { value: 'CODECHEF',       label: 'CodeChef',       abbr: 'CC', cls: 'codechef',       placeholder: 'https://www.codechef.com/users/username' },
  { value: 'HACKERRANK',     label: 'HackerRank',     abbr: 'HR', cls: 'hackerrank',     placeholder: 'https://www.hackerrank.com/profile/username' },
  { value: 'ATCODER',        label: 'AtCoder',        abbr: 'AC', cls: 'atcoder',        placeholder: 'https://atcoder.jp/users/username' },
  { value: 'SKILLRACK',      label: 'SkillRack',      abbr: 'SR', cls: 'skillrack',      placeholder: 'https://www.skillrack.com/faces/resume.xhtml?id=...&key=...' },
];

export default function StudentDashboard() {
  const { student, isLoggedIn } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [semester, setSemester] = useState('');
  const [searchId, setSearchId] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifyPlatforms, setVerifyPlatforms] = useState({});

  // Calculate semester from roll number
  // Roll number format: YY[DEPT][ID] e.g., 24CS422
  // 24 = 2024 admission year
  function calculateSemester(rollNumber) {
    if (!rollNumber || rollNumber.length < 2) return 1;

    const yearPrefix = parseInt(rollNumber.substring(0, 2), 10);
    if (isNaN(yearPrefix)) return 1;

    const admissionYear = 2000 + yearPrefix; // 24 → 2024
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 0-indexed, so add 1

    const yearsPassed = currentYear - admissionYear;
    const baseSemester = yearsPassed * 2; // 2 semesters per year

    // If current month >= August (8), we're in odd semester (1, 3, 5, 7)
    // Otherwise, we're in even semester (2, 4, 6, 8)
    const currentSemester = currentMonth >= 8 ? baseSemester + 1 : baseSemester;

    // Cap at semester 8
    return Math.min(Math.max(currentSemester, 1), 8);
  }

  // Auto-fill student ID and semester from auth
  useEffect(() => {
    if (isLoggedIn && student?.rollNumber) {
      setStudentId(student.rollNumber);
      setSearchId(student.rollNumber);
      const calculatedSem = calculateSemester(student.rollNumber);
      setSemester(calculatedSem.toString());
      loadEvidence(student.rollNumber);
    }
  }, [isLoggedIn, student?.rollNumber]);

  // Load verification platform info
  useEffect(() => {
    if (isLoggedIn) {
      getVerificationPlatforms()
        .then((data) => setVerifyPlatforms(data.platforms || {}))
        .catch(() => {});
    }
  }, [isLoggedIn]);

  const loadEvidence = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getStudentEvidence(id);
      setEvidence(data);
    } catch {
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (!studentId.trim()) return;
    const id = studentId.trim();
    setSearchId(id);
    if (!isLoggedIn) {
      // For non-logged-in users, calculate semester from entered ID
      const calculatedSem = calculateSemester(id);
      setSemester(calculatedSem.toString());
    }
    loadEvidence(id);
  }

  function getEvidenceForPlatform(platformValue) {
    return evidence.find((e) => e.platform === platformValue) || null;
  }

  async function handleSyncAll() {
    setSyncing(true);
    let success = 0;
    let failed = 0;
    for (const row of evidence) {
      try {
        await refetchEvidence(row.id);
        success++;
      } catch {
        failed++;
      }
    }
    setSyncing(false);
    if (failed > 0) {
      toast.success(`Synced ${success}, ${failed} failed`);
    } else {
      toast.success(`All ${success} platform${success !== 1 ? 's' : ''} synced`);
    }
    loadEvidence(searchId);
  }

  const isOwnProfile = isLoggedIn && searchId === student?.rollNumber;

  // Only count VERIFIED platforms for marks/achievements
  const verifiedEvidence = evidence.filter(e => e.verified);
  const totalProblems = verifiedEvidence.reduce((s, e) => s + (e.totalProblemsSolved || 0), 0);
  const totalSql = verifiedEvidence.reduce((s, e) => s + (e.sqlProblemsSolved || 0), 0);

  // Platform count shows all, but marks only count verified
  const platformCount = evidence.length;
  const verifiedCount = verifiedEvidence.length;

  return (
    <>
      {/* Student ID + Semester */}
      <div className="card">
        <div className="card-body">
          <form className="student-id-bar" onSubmit={handleSearch}>
            <div className="form-group">
              <label className="form-label">Student ID</label>
              <input
                className="form-input"
                placeholder="e.g. 24CS212"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                readOnly={isLoggedIn}
                disabled={isLoggedIn}
                style={isLoggedIn ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                title={isLoggedIn ? 'Student ID is locked when logged in' : ''}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Semester</label>
              <input
                className="form-input"
                value={semester ? `Semester ${semester}` : 'Auto-calculated'}
                readOnly
                disabled
                style={{ cursor: 'not-allowed', opacity: 0.7 }}
                title="Semester is automatically calculated from roll number year"
              />
            </div>
            {!isLoggedIn && (
              <div className="form-group" style={{ alignSelf: 'flex-end' }}>
                <button className="btn btn-primary" type="submit">
                  <Search size={16} />
                  Load
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {searchId && (
        <>
          {/* Platform rows */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <div>
                <h2>Problem Solving</h2>
                <p>Link your coding platform profiles</p>
              </div>
              {evidence.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSyncAll}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                  {syncing ? 'Syncing...' : 'Sync All'}
                </button>
              )}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="loading-row">
                  <div className="spinner" />
                  <p>Loading...</p>
                </div>
              ) : (
                <div className="platform-list">
                  {PLATFORMS.map((p) => (
                    <PlatformRow
                      key={p.value}
                      platform={p}
                      evidence={getEvidenceForPlatform(p.value)}
                      studentId={searchId}
                      semester={semester}
                      onChanged={() => loadEvidence(searchId)}
                      isLoggedIn={isOwnProfile}
                      verificationInfo={verifyPlatforms[p.value]}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Verification Warning */}
          {evidence.length > 0 && verifiedCount < platformCount && (
            <div style={{
              marginTop: 20,
              padding: '15px 20px',
              background: 'var(--warning-light)',
              borderRadius: '8px',
              borderLeft: '4px solid var(--warning)',
              fontSize: '14px'
            }}>
              <strong>⚠️ Verification Required:</strong> You have {platformCount - verifiedCount} unverified platform(s).
              Only verified platforms count towards your marks and achievements. Click the "Verify" button to confirm profile ownership.
            </div>
          )}

          {/* Stats */}
          {evidence.length > 0 && (
            <div className="stats-row" style={{ marginTop: 20 }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <Code2 size={20} />
                </div>
                <span className="stat-value">{totalProblems.toLocaleString()}</span>
                <span className="stat-label">Total Problems Solved</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  (From {verifiedCount} verified platform{verifiedCount !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
                  <Database size={20} />
                </div>
                <span className="stat-value">{totalSql.toLocaleString()}</span>
                <span className="stat-label">SQL Problems Solved</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  (From {verifiedCount} verified platform{verifiedCount !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
                  <Trophy size={20} />
                </div>
                <span className="stat-value">{verifiedCount}/{platformCount}</span>
                <span className="stat-label">Verified Platforms</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                  ({Math.round((verifiedCount / platformCount) * 100)}% verified)
                </span>
              </div>
            </div>
          )}

          {/* Marks & Achievement Progress (combined) */}
          {evidence.length > 0 && (
            <MarksDisplay
              totalSolved={totalProblems}
              sqlSolved={totalSql}
            />
          )}

          {/* Detail table */}
          {evidence.length > 0 && (
            <EvidenceTable
              evidence={evidence}
              loading={false}
              onUpdated={() => loadEvidence(searchId)}
            />
          )}
        </>
      )}
    </>
  );
}
