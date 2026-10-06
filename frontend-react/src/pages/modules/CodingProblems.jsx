import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import { getStudent } from '../../utils/auth';
import { moduleAPI } from '../../services/api';
import './CodingPlatform.css';

const PLATFORMS = [
  { value: 'LEETCODE', label: 'LeetCode', abbr: 'LC', cls: 'logo-leetcode', placeholder: 'https://leetcode.com/u/username' },
  { value: 'CODEFORCES', label: 'Codeforces', abbr: 'CF', cls: 'logo-codeforces', placeholder: 'https://codeforces.com/profile/username' },
  { value: 'GEEKSFORGEEKS', label: 'GeeksforGeeks', abbr: 'GG', cls: 'logo-geeksforgeeks', placeholder: 'https://www.geeksforgeeks.org/user/username' },
  { value: 'CODECHEF', label: 'CodeChef', abbr: 'CC', cls: 'logo-codechef', placeholder: 'https://www.codechef.com/users/username' },
  { value: 'HACKERRANK', label: 'HackerRank', abbr: 'HR', cls: 'logo-hackerrank', placeholder: 'https://www.hackerrank.com/profile/username' },
  { value: 'ATCODER', label: 'AtCoder', abbr: 'AC', cls: 'logo-atcoder', placeholder: 'https://atcoder.jp/users/username' },
  { value: 'SKILLRACK', label: 'SkillRack', abbr: 'SR', cls: 'logo-skillrack', placeholder: 'https://www.skillrack.com/faces/resume.xhtml?id=...&key=...' },
];

const CodingProblems = () => {
  const student = getStudent();
  const rollNumber = student?.roll_number || '24CS422';

  // Calculate semester based on roll number
  const getSemester = (roll) => {
    const yr = parseInt(roll?.substring(0, 2), 10);
    if (isNaN(yr)) return 5;
    const admissionYear = 2000 + yr;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const yearsPassed = currentYear - admissionYear;
    const baseSem = yearsPassed * 2;
    return Math.min(Math.max(currentMonth >= 8 ? baseSem + 1 : baseSem, 1), 8);
  };

  const currentSemester = getSemester(rollNumber);

  // States
  const [urls, setUrls] = useState({});
  const [evidenceList, setEvidenceList] = useState([]);
  const [stats, setStats] = useState({
    totalSolved: 0,
    sqlSolved: 0,
    marks: 0,
    maxMarks: 25,
  });

  const [loadingPlatform, setLoadingPlatform] = useState({});
  const [alert, setAlert] = useState(null);

  // Verification modal state
  const [activeModalPlatform, setActiveModalPlatform] = useState(null);
  const [modalStep, setModalStep] = useState(1);
  const [verifyToken, setVerifyToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

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
        moduleAPI.getCodingProblemsEvidence(rollNumber),
        moduleAPI.getCodingProblemsMarks(rollNumber),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);

      const urlMap = {};
      list.forEach((item) => {
        if (item.profile_url) {
          urlMap[item.platform] = item.profile_url;
        }
      });
      setUrls((prev) => ({ ...prev, ...urlMap }));

      setStats({
        totalSolved: marksRes?.total_solved_sum || marksRes?.total_solved || 0,
        sqlSolved: marksRes?.sql_solved_sum || marksRes?.sql_solved || 0,
        marks: marksRes?.marks || 0,
        maxMarks: 25,
      });
    } catch (err) {
      console.error('Failed to load coding evidence:', err);
    }
  };

  const handleUrlChange = (platformKey, val) => {
    setUrls((prev) => ({ ...prev, [platformKey]: val }));
  };

  const handleSubmitProfile = async (platformObj) => {
    const url = urls[platformObj.value];
    if (!url || !url.trim()) {
      showAlert(`Please enter a valid URL for ${platformObj.label}`, 'error');
      return;
    }

    setLoadingPlatform((prev) => ({ ...prev, [platformObj.value]: true }));

    try {
      // Extract username from URL
      let username = 'user';
      try {
        const parsed = new URL(url.trim());
        const segments = parsed.pathname.split('/').filter(Boolean);
        username = segments[segments.length - 1] || 'user';
      } catch {
        username = 'user';
      }

      const res = await moduleAPI.submitCodingProblems({
        platform: platformObj.value,
        username: username,
        total_solved: 0,
        sql_solved: 0,
        profile_url: url.trim(),
        fetch_method: 'SCRAPER',
      });

      if (res.success) {
        if (res.is_verified) {
          showAlert(`${platformObj.label} profile updated!`, 'success');
        } else {
          showAlert(`${platformObj.label} profile linked! Please verify ownership to count verified marks.`, 'success');
          openVerificationModal(platformObj);
        }
        await loadData();
      } else {
        showAlert(res.message || 'Submission failed', 'error');
      }
    } catch (err) {
      showAlert('Network error submitting profile', 'error');
    } finally {
      setLoadingPlatform((prev) => ({ ...prev, [platformObj.value]: false }));
    }
  };

  // Verification Wizard Handlers
  const openVerificationModal = (platformObj) => {
    setActiveModalPlatform(platformObj);
    setModalStep(1);
    setVerifyToken('');
    setCopied(false);
  };

  const handleStartVerification = () => {
    setModalLoading(true);
    setTimeout(() => {
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
      const token = `VERIFY-${rollNumber}-${rand}`;
      setVerifyToken(token);
      setModalStep(2);
      setModalLoading(false);
    }, 400);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verifyToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmVerification = async () => {
    setModalLoading(true);
    try {
      const res = await moduleAPI.verifyCodingProblemsOwnership({
        platform: activeModalPlatform.value,
        profile_url: urls[activeModalPlatform.value] || null,
        verification_token: verifyToken,
      });
      setModalStep(3);
      showAlert(`Ownership verified for ${activeModalPlatform.label}!`, 'success');
      await loadData();
    } catch (err) {
      showAlert(err.message || 'Verification failed. Please try again.', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRemoveProfile = async (platformObj) => {
    const isConfirmed = window.confirm(`Are you sure you want to remove your ${platformObj.label} profile URL and linked data?`);
    if (!isConfirmed) return;

    setLoadingPlatform((prev) => ({ ...prev, [platformObj.value]: true }));

    try {
      const res = await moduleAPI.removeCodingProblems({ platform: platformObj.value });
      if (res.success) {
        setUrls((prev) => ({ ...prev, [platformObj.value]: '' }));
        showAlert(`${platformObj.label} profile removed successfully!`, 'success');
        await loadData();
      } else {
        showAlert(res.message || 'Failed to remove profile', 'error');
      }
    } catch (err) {
      console.error('Error removing platform profile:', err);
      showAlert('Failed to remove platform profile', 'error');
    } finally {
      setLoadingPlatform((prev) => ({ ...prev, [platformObj.value]: false }));
    }
  };

  const getEvidenceForPlatform = (platformKey) => {
    return evidenceList.find((e) => e.platform === platformKey);
  };

  return (
    <div className="coding-page">
      <Header />
      <div className="coding-container">
        {alert && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            background: alert.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: alert.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${alert.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            fontWeight: 500,
          }}>
            {alert.message}
          </div>
        )}

        {/* Top Header Card with Meta Information */}
        <div className="coding-header-card">
          <div className="student-meta-fields">
            <div className="meta-field-group">
              <label>Student ID</label>
              <input type="text" value={rollNumber} readOnly />
            </div>
            <div className="meta-field-group">
              <label>Semester</label>
              <input type="text" value={`Semester ${currentSemester}`} readOnly />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                {stats.totalSolved}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Solved
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                {stats.sqlSolved}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                SQL Solved
              </div>
            </div>
            <div style={{ textAlign: 'right', borderLeft: '1px solid #e2e8f0', paddingLeft: '1.5rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#4f46e5' }}>
                {stats.marks} / {stats.maxMarks}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Verified Marks
              </div>
            </div>
          </div>
        </div>

        {/* Problem Solving List Card */}
        <div className="coding-section-card">
          <h2 className="section-title">Problem Solving</h2>
          <p className="section-subtitle">Link your coding platform profiles and verify ownership</p>

          <div className="platform-rows-list">
            {PLATFORMS.map((plat) => {
              const ev = getEvidenceForPlatform(plat.value);
              const isSaved = !!ev;
              const isVerified = ev?.status === 'VERIFIED';
              const isLoading = loadingPlatform[plat.value];

              return (
                <div key={plat.value} className="platform-row">
                  <div className="platform-badge-pill">
                    <div className={`platform-logo-icon ${plat.cls}`}>
                      {plat.abbr}
                    </div>
                    <span className="platform-name">{plat.label} ›</span>
                  </div>

                  <div className="platform-input-wrapper">
                    <input
                      type="url"
                      className="platform-input"
                      placeholder={plat.placeholder}
                      value={urls[plat.value] || ''}
                      onChange={(e) => handleUrlChange(plat.value, e.target.value)}
                    />
                  </div>

                  <div className="platform-actions">
                    {isVerified ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                          {ev.total_solved || 0} Solved ({ev.sql_solved || 0} SQL)
                        </span>
                        <span className="btn-verify-badge badge-verified">
                          ✓ Verified
                        </span>
                        <button
                          type="button"
                          title="Re-fetch stats from platform"
                          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                          disabled={isLoading}
                          onClick={() => handleSubmitProfile(plat)}
                        >
                          {isLoading ? '⏳' : '🔄'}
                        </button>
                      </div>
                    ) : isSaved ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {ev?.total_solved > 0 && (
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                            {ev.total_solved} Solved ({ev.sql_solved || 0} SQL)
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn-verify-badge badge-unverified"
                          onClick={() => openVerificationModal(plat)}
                        >
                          ⚠️ Verify Ownership
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="btn-submit-platform"
                      disabled={isLoading}
                      onClick={() => handleSubmitProfile(plat)}
                    >
                      {isLoading ? 'Saving...' : 'Submit'}
                    </button>

                    {(isSaved || (urls[plat.value] && urls[plat.value].trim().length > 0)) && (
                      <button
                        type="button"
                        className="btn-remove-platform"
                        title={`Remove ${plat.label} profile`}
                        disabled={isLoading}
                        onClick={() => handleRemoveProfile(plat)}
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tier Matrix Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
            📊 Scoring Tiers (Both Thresholds Required)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { tier: 'Tier 5', marks: 25, req: '1000+ Total & 75+ SQL' },
              { tier: 'Tier 4', marks: 20, req: '750+ Total & 60+ SQL' },
              { tier: 'Tier 3', marks: 15, req: '550+ Total & 45+ SQL' },
              { tier: 'Tier 2', marks: 10, req: '350+ Total & 30+ SQL' },
              { tier: 'Tier 1', marks: 5, req: '200+ Total & 20+ SQL' },
            ].map((t) => (
              <div key={t.tier} style={{
                background: '#f8fafc',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '0.95rem' }}>
                  {t.tier}: {t.marks} Marks
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {t.req}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {activeModalPlatform && (
        <div className="verify-modal-backdrop" onClick={() => setActiveModalPlatform(null)}>
          <div className="verify-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="verify-modal-header">
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#6366f1' }}>
                  Step {modalStep} of 3
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  Verify {activeModalPlatform.label} Ownership
                </h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}
                onClick={() => setActiveModalPlatform(null)}
              >
                ✕
              </button>
            </div>

            <div className="verify-modal-body">
              <div className="step-indicator-bar">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`step-dot ${modalStep === s ? 'active' : modalStep > s ? 'done' : ''}`}>
                    {modalStep > s ? '✓' : s}
                  </div>
                ))}
              </div>

              {modalStep === 1 && (
                <div>
                  <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.6' }}>
                    To confirm that you own this profile, you will add a unique verification code to your {activeModalPlatform.label} public bio or summary for 10 minutes.
                  </p>
                  <div style={{
                    marginTop: '1.25rem',
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.85rem',
                    color: '#64748b',
                  }}>
                    🔒 <strong>Security Guarantee:</strong> Prevents unauthorized profile claims and ensures verified points belong to your roll number.
                  </div>
                </div>
              )}

              {modalStep === 2 && (
                <div>
                  <p style={{ color: '#475569', fontSize: '0.9rem' }}>
                    Copy this verification code and paste it into your <strong>{activeModalPlatform.label} bio / name</strong>:
                  </p>

                  <div className="token-copy-box">
                    <span className="token-code">{verifyToken}</span>
                    <button
                      type="button"
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                      onClick={handleCopyToken}
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="instructions-list">
                    1. Go to your {activeModalPlatform.label} profile settings.<br />
                    2. Paste the code into your <strong>Bio / Summary</strong>.<br />
                    3. Save your changes and click <strong>Verify Profile</strong> below.
                  </div>
                </div>
              )}

              {modalStep === 3 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ fontSize: '3rem', color: '#10b981', marginBottom: '0.5rem' }}>✓</div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Verification Successful!</h4>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                    Your {activeModalPlatform.label} profile has been verified and linked to {rollNumber}.
                  </p>
                </div>
              )}
            </div>

            <div className="verify-modal-footer">
              {modalStep === 1 && (
                <button
                  type="button"
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  disabled={modalLoading}
                  onClick={handleStartVerification}
                >
                  {modalLoading ? 'Generating...' : 'Start Verification →'}
                </button>
              )}

              {modalStep === 2 && (
                <button
                  type="button"
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  disabled={modalLoading}
                  onClick={handleConfirmVerification}
                >
                  {modalLoading ? 'Verifying...' : `Verify ${activeModalPlatform.label} Profile`}
                </button>
              )}

              {modalStep === 3 && (
                <button
                  type="button"
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: '#4f46e5',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveModalPlatform(null)}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodingProblems;
