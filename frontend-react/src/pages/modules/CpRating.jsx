import { useState, useEffect } from 'react';
import Header from '../../components/Header';
import { moduleAPI } from '../../services/api';
import { getStudent } from '../../utils/auth';
import './Competition.css';

const CpRating = () => {
  const student = getStudent();
  const rollNumber = student?.roll_number || '24CS422';

  const [stats, setStats] = useState({
    bestRating: 0,
    bestPlatform: null,
    bestTier: null,
    marks: 0,
    maxMarks: 20,
    platformsCount: 0,
    platforms: [],
  });

  const [evidenceList, setEvidenceList] = useState([]);
  const [alert, setAlert] = useState(null);
  const [syncing, setSyncing] = useState(false);

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
        moduleAPI.getCPRatingEvidence(rollNumber),
        moduleAPI.getCPRatingMarks(rollNumber),
      ]);

      const list = evidenceRes?.evidence || [];
      setEvidenceList(list);
      setStats({
        bestRating: marksRes?.best_rating || 0,
        bestPlatform: marksRes?.best_platform || null,
        bestTier: marksRes?.best_tier || null,
        marks: marksRes?.marks || 0,
        maxMarks: 20,
        platformsCount: list.length,
        platforms: marksRes?.platforms || [],
      });
    } catch (error) {
      console.error('Error loading CP Rating data:', error);
    }
  };

  const handleSyncFromCodingPlatforms = async () => {
    setSyncing(true);
    try {
      const res = await moduleAPI.syncCPRatingFromCodingPlatforms();
      if (res.success) {
        showAlert(res.message || 'Ratings synced from verified coding platforms!', 'success');
        await loadData();
      } else {
        showAlert(res.error || 'Failed to sync ratings', 'error');
      }
    } catch (err) {
      showAlert('Network error while syncing ratings', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="competition-page">
      <Header />
      <div className="competition-container">
        <div className="page-header">
          <h1>🏆 Competitive Programming (CP) Rating</h1>
          <p>Ratings are strictly auto-extracted from your verified Coding Platform profiles (Max 20 Marks)</p>
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
              Calculated Marks
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
              {stats.bestRating || '—'}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Single Best Rating
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
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {stats.bestPlatform || 'None'}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Top Rating Platform
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
              {stats.platformsCount}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
              Verified Platforms
            </div>
          </div>
        </div>

        {/* Auto-Sync Quick Action Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.25rem 1.75rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
              ⚡ 100% Auto-Synced from Coding Platform Module
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
              Live contest ratings (LeetCode, Codeforces, CodeChef, AtCoder) are automatically extracted and verified directly from your linked profiles.
            </p>
          </div>
          <button
            type="button"
            style={{
              padding: '0.65rem 1.25rem',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            disabled={syncing}
            onClick={handleSyncFromCodingPlatforms}
          >
            {syncing ? '⏳ Syncing...' : '🔄 Re-sync All Ratings'}
          </button>
        </div>

        {/* 1. Linked Ratings List (Auto-Extraction TOP) */}
        <div className="submissions-card" style={{ width: '100%', background: '#ffffff', borderRadius: '16px', padding: '1.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem' }}>
            ⚡ Your Auto-Extracted Platform Ratings ({evidenceList.length})
          </h2>

          {evidenceList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                No ratings extracted yet.
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Link and verify your profiles in the <strong>Coding Platform</strong> module, then click <strong>Re-sync All Ratings</strong> above.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                      {item.platform}
                    </span>
                    <span style={{ background: '#ecfdf5', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.75rem' }}>
                      ✓ Auto-Synced
                    </span>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#4f46e5' }}>
                      {item.current_rating}
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b', marginLeft: '0.4rem' }}>Rating</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                      User: <strong>{item.username}</strong>
                    </div>
                  </div>

                  {item.profile_url && (
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                      <a
                        href={item.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                      >
                        View External Profile ↗
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Tier Matrix Card (Rating Thresholds DOWN) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          marginBottom: '1.75rem',
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>
            📊 Rating Thresholds (Single Best Platform Evaluated)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '1rem', marginBottom: '0.4rem' }}>
                🏆 20 Marks
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                • Codeforces: <strong>1800+</strong> (Expert)<br />
                • LeetCode: <strong>2000+</strong> (Knight)<br />
                • CodeChef: <strong>2000+</strong> (5★)<br />
                • AtCoder: <strong>1600+</strong> (Blue)
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '1rem', marginBottom: '0.4rem' }}>
                🥇 15 Marks
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                • Codeforces: <strong>1600+</strong> (Specialist)<br />
                • LeetCode: <strong>1800+</strong> (Guardian)<br />
                • CodeChef: <strong>1800+</strong> (4★)<br />
                • AtCoder: <strong>1200+</strong> (Cyan)
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '1rem', marginBottom: '0.4rem' }}>
                🥈 10 Marks
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                • Codeforces: <strong>1400+</strong> (Pupil)<br />
                • LeetCode: <strong>1600+</strong> (Intermediate)<br />
                • CodeChef: <strong>1600+</strong> (3★)<br />
                • AtCoder: <strong>800+</strong> (Green)
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#4f46e5', fontSize: '1rem', marginBottom: '0.4rem' }}>
                🥉 5 Marks
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                • Codeforces: <strong>1200+</strong> (Newbie)<br />
                • LeetCode: <strong>1400+</strong> (Beginner)<br />
                • CodeChef: <strong>1400+</strong> (2★)<br />
                • AtCoder: <strong>400+</strong> (Brown)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CpRating;
