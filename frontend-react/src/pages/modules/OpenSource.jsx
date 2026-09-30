import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';
import './CodingPlatform.css';

const OpenSource = () => {
  const student = getStudent();
  const rollNumber = student?.roll_number || '24CS422';

  const [githubUrl, setGithubUrl] = useState('');
  const [stats, setStats] = useState({
    marks: 0,
    maxMarks: 20,
    reposCount: 0,
    totalPrsMerged: 0,
    totalPrsSubmitted: 0,
  });

  const [evidenceList, setEvidenceList] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Verification modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [targetUsername, setTargetUsername] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 6000);
  };

  const loadData = async () => {
    try {
      const [evidenceRes, marksRes] = await Promise.all([
        moduleAPI.getOpenSourceEvidence(rollNumber),
        moduleAPI.getOpenSourceMarks(rollNumber),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        marks: marksRes?.marks || 0,
        maxMarks: 20,
        reposCount: list.length,
        totalPrsMerged: list.reduce((sum, item) => sum + (item.prs_merged || 0), 0),
        totalPrsSubmitted: list.reduce((sum, item) => sum + (item.prs_submitted || 0), 0),
      });
    } catch (error) {
      console.error('Error loading Open Source data:', error);
    }
  };

  const primaryGithubUser = evidenceList.length > 0 ? evidenceList[0].github_username : null;

  // Handler for adding repo / PR or initiating verification
  const handleFetchAndSubmit = async (e) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      showAlert('Please enter a valid GitHub profile or repository URL', 'error');
      return;
    }

    // Extract handle/username from input
    let cleanInput = githubUrl.trim();
    let parsedUser = cleanInput;
    const match = cleanInput.match(/github\.com\/([^/?#]+)/i);
    if (match) {
      parsedUser = match[1];
    } else {
      parsedUser = cleanInput.replace('@', '');
    }

    // If no GitHub account is bound yet, start the anti-fraud ownership verification modal
    if (!primaryGithubUser) {
      setTargetUsername(parsedUser);
      setShowVerifyModal(true);
      setModalStep(1);
      setVerifyToken('');
      setCopied(false);
      return;
    }

    // If already bound, perform repo/PR submission
    setLoading(true);
    try {
      const res = await moduleAPI.submitOpenSource({
        github_url: githubUrl.trim(),
      });

      if (res.success) {
        showAlert(res.message || 'GitHub details fetched and marks allotted successfully!', 'success');
        setGithubUrl('');
        await loadData();
      } else {
        showAlert(res.message || res.error || 'Failed to fetch GitHub details', 'error');
      }
    } catch (error) {
      showAlert(error.message || 'Network error while connecting to GitHub. Please check URL and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Verification Wizard Handlers
  const handleStartVerification = () => {
    setModalLoading(true);
    setTimeout(() => {
      const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
      const token = `VERIFY-${rollNumber}-${rand}`;
      setVerifyToken(token);
      setModalStep(2);
      setModalLoading(false);
    }, 300);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(verifyToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmVerification = async () => {
    setModalLoading(true);
    try {
      const res = await moduleAPI.verifyOpenSourceOwnership({
        github_username: targetUsername,
        github_url: githubUrl.trim(),
        token: verifyToken,
      });

      if (res.success && res.verified) {
        setModalStep(3);
        showAlert(`Ownership verified for GitHub @${targetUsername}! Marks allotted: ${res.marks}/20`, 'success');
        setGithubUrl('');
        await loadData();
      } else {
        showAlert(res.message || 'Verification failed. Make sure the code is saved in your GitHub bio.', 'error');
      }
    } catch (err) {
      showAlert(err.message || 'Verification failed. Could not find verification code in your GitHub bio.', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await moduleAPI.syncOpenSource();
      if (res.success) {
        showAlert(res.message || 'Open Source contributions re-synced successfully!', 'success');
        await loadData();
      } else {
        showAlert(res.message || 'Re-sync failed', 'error');
      }
    } catch (err) {
      showAlert('Network error re-syncing GitHub contributions', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteContribution = async (id) => {
    if (!window.confirm('Are you sure you want to remove this contribution?')) return;
    setDeletingId(id);
    try {
      const res = await moduleAPI.deleteOpenSource(id);
      if (res.success) {
        showAlert('Contribution removed and marks recalculated!', 'success');
        await loadData();
      } else {
        showAlert(res.message || 'Failed to remove contribution', 'error');
      }
    } catch (err) {
      showAlert('Error removing contribution', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="competition-page">
      <Header />
      <div className="competition-container">
        <div className="page-header">
          <h1>🌐 Open Source Contributions</h1>
          <p>Link and verify your authentic GitHub profile to auto-fetch merged PRs, maintainer status, and earn up to 20 Marks.</p>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

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
              Computed Marks
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
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669' }}>
              {stats.totalPrsMerged}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Total PRs Merged
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
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#4f46e5' }}>
              {stats.totalPrsSubmitted}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Total PRs Submitted
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
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e293b' }}>
              {stats.reposCount}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Contributions Linked
            </div>
          </div>
        </div>

        {/* Account Binding & Anti-Fraud Banner */}
        {primaryGithubUser ? (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.35rem' }}>🛡️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem' }}>
                  Verified GitHub Account: <span style={{ color: '#15803d' }}>@{primaryGithubUser}</span>
                </div>
                <div style={{ fontSize: '0.825rem', color: '#15803d' }}>
                  Anti-Fraud Protected: Only PRs authored by <strong>@{primaryGithubUser}</strong> are verified for your roll number ({rollNumber}).
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <a
                href={`https://github.com/${primaryGithubUser}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  color: '#15803d',
                  textDecoration: 'none',
                  background: '#dcfce7',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                }}
              >
                View Profile ↗
              </a>
            </div>
          </div>
        ) : (
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '14px',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.35rem' }}>🔒</span>
            <div>
              <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>
                Anti-Fraud Ownership Verification Required
              </div>
              <div style={{ fontSize: '0.825rem', color: '#2563eb' }}>
                To claim marks, you must verify that you own your GitHub profile by adding a temporary verification token to your GitHub bio.
              </div>
            </div>
          </div>
        )}

        {/* Automated GitHub Submission Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '1.75rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                {primaryGithubUser ? '🚀 Add Repository / Fetch PRs' : '🚀 Link Your GitHub Profile'}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                {primaryGithubUser
                  ? `Enter a third-party Repository or PR URL to fetch contributions authored by @${primaryGithubUser}.`
                  : 'Enter your GitHub profile URL (e.g. https://github.com/your-username) to verify ownership and calculate marks.'}
              </p>
            </div>
            {primaryGithubUser && (
              <button
                type="button"
                style={{
                  padding: '0.65rem 1.25rem',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                disabled={syncing}
                onClick={handleSyncAll}
              >
                {syncing ? '⏳ Syncing...' : '🔄 Re-sync All Contributions'}
              </button>
            )}
          </div>

          <form onSubmit={handleFetchAndSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder={primaryGithubUser ? `https://github.com/owner/repo or https://github.com/${primaryGithubUser}` : "https://github.com/your-username"}
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              style={{
                flex: 1,
                minWidth: '280px',
                padding: '0.85rem 1.15rem',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '0.95rem',
                outline: 'none',
              }}
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.85rem 1.75rem',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap',
              }}
            >
              {loading
                ? '⏳ Fetching & Allotting...'
                : primaryGithubUser
                ? '⚡ Fetch & Allot Marks'
                : '🛡️ Verify & Link Account'}
            </button>
          </form>
        </div>

        {/* 1. Live Verified GitHub Contributions List (TOP) */}
        <div className="submissions-card" style={{ width: '100%', background: '#ffffff', borderRadius: '16px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
            ⚡ Your Verified Open Source Contributions ({evidenceList.length})
          </h2>

          {evidenceList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                No GitHub account or contributions linked yet.
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Paste your GitHub profile URL in the box above and complete the quick 1-minute ownership verification to automatically fetch your merged PRs and receive marks!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem' }}>
              {evidenceList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                        {item.repo_name || item.programme_name || 'Open Source Repo'}
                      </span>
                      <span style={{ background: '#ecfdf5', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem' }}>
                        ✓ {item.status || 'VERIFIED'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem' }}>
                      GitHub User: <strong style={{ color: '#1e293b' }}>@{item.github_username}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div style={{ background: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                        <span style={{ color: '#059669', fontWeight: 700 }}>{item.prs_merged || 0}</span> Merged PRs
                      </div>
                      <div style={{ background: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                        <span style={{ color: '#6366f1', fontWeight: 700 }}>{item.prs_submitted || 0}</span> Submitted
                      </div>
                      {item.is_maintainer && (
                        <div style={{ background: '#fef3c7', color: '#b45309', padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                          ⭐ Maintainer
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {item.repo_url ? (
                      <a
                        href={item.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                      >
                        View on GitHub ↗
                      </a>
                    ) : <div />}

                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => handleDeleteContribution(item.id)}
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Remove contribution"
                    >
                      {deletingId === item.id ? '...' : '🗑️ Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Open Source Scoring Tier System (DOWN) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '1.75rem',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
            📊 Open Source Contribution Scoring Matrix (Max 20 Marks, Capped Sum)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.9rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5' }}>Stage 6: 20 Marks</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Maintainer / Programme Completion</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5' }}>Stage 5: 17 Marks</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Selected in Approved Programme</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5' }}>Stage 4: 15 Marks</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>5+ PRs Merged</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5' }}>Stage 3: 10 Marks</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>3 PRs Merged</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5' }}>Stage 2: 5 Marks</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>1 PR Merged</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5' }}>Stage 1: 3 Marks</div>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>1 PR Submitted</div>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="verify-modal-backdrop" onClick={() => setShowVerifyModal(false)}>
          <div className="verify-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="verify-modal-header">
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#6366f1' }}>
                  Anti-Fraud Verification • Step {modalStep} of 3
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                  Verify GitHub Ownership (@{targetUsername})
                </h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8' }}
                onClick={() => setShowVerifyModal(false)}
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
                    To prevent students from claiming other users' GitHub accounts or PRs, you need to prove ownership of <strong>@{targetUsername}</strong> by placing a temporary verification code in your GitHub bio.
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
                    🛡️ <strong>Anti-Fraud Guarantee:</strong> Once verified, this GitHub account is permanently locked to your roll number (<strong>{rollNumber}</strong>). No other student can claim your contributions or marks.
                  </div>
                </div>
              )}

              {modalStep === 2 && (
                <div>
                  <p style={{ color: '#475569', fontSize: '0.9rem' }}>
                    Copy this verification code and paste it into your <strong>GitHub Bio or Name</strong>:
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
                    1. Go to <a href="https://github.com/settings/profile" target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5', fontWeight: 600 }}>GitHub Profile Settings ↗</a><br />
                    2. Paste the code anywhere in your <strong>Bio</strong> or <strong>Name</strong>.<br />
                    3. Click <strong>Update profile</strong> on GitHub, then click <strong>Verify & Link Account</strong> below.
                  </div>
                </div>
              )}

              {modalStep === 3 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ fontSize: '3rem', color: '#10b981', marginBottom: '0.5rem' }}>✓</div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Ownership Verified & Linked!</h4>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                    Your GitHub profile <strong>@{targetUsername}</strong> is now securely verified and linked to {rollNumber}. Your live PRs and marks have been automatically recorded.
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
                  {modalLoading ? 'Generating...' : 'Generate Verification Token →'}
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
                  {modalLoading ? 'Verifying on GitHub...' : 'Verify & Link Account'}
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
                  onClick={() => setShowVerifyModal(false)}
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

export default OpenSource;
