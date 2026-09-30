import { useState } from 'react';
import { CheckCircle2, Trash2, Loader2, ChevronRight, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchSync, deleteEvidence, refetchEvidence } from '../api';
import VerificationModal from './VerificationModal';

export default function PlatformRow({ platform, evidence, studentId, semester, onChanged, isLoggedIn, verificationInfo }) {
  const [url, setUrl] = useState(evidence?.profileUrl || '');
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const saved = !!evidence;
  const verified = evidence?.verified || false;

  const canVerify = isLoggedIn && saved && !verified && verificationInfo?.supported;

  async function handleSubmit() {
    if (!url.trim()) {
      toast.error('Please enter a profile URL');
      return;
    }
    if (!studentId || !semester) {
      toast.error('Enter Student ID and Semester first');
      return;
    }
    setLoading(true);
    try {
      const result = await fetchSync({
        studentId,
        semester: parseInt(semester, 10),
        platform: platform.value,
        profileUrl: url.trim(),
      });
      if (result.warning) {
        toast(result.warning, { icon: '⚠️', duration: 8000 });
      }
      const ev = result.evidence;
      toast.success(`${platform.label}: ${ev.totalProblemsSolved} problems fetched`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!evidence) return;
    setLoading(true);
    try {
      await deleteEvidence(evidence.id);
      setUrl('');
      toast.success(`${platform.label} removed`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!evidence) return;
    setLoading(true);
    try {
      const result = await refetchEvidence(evidence.id);
      const ev = result.evidence;
      toast.success(`${platform.label}: ${ev.totalProblemsSolved} problems`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function renderVerificationBadge() {
    if (!saved || !isLoggedIn) return null;
    if (verified) {
      return (
        <span className="verify-badge verified" title="Verified">
          <ShieldCheck size={16} />
          Verified
        </span>
      );
    }
    if (verificationInfo?.supported) {
      return (
        <span className="verify-badge unverified" title="Not verified">
          <ShieldAlert size={16} />
          Not Verified
        </span>
      );
    }
    return (
      <span className="verify-badge unsupported" title={verificationInfo?.reason || 'Verification not available'}>
        <ShieldQuestion size={16} />
        N/A
      </span>
    );
  }

  return (
    <>
      <div className="platform-row">
        <div className="platform-row-label" onClick={saved ? handleRefresh : undefined} title={saved ? 'Click to refresh' : ''}>
          <span className={`platform-icon-lg ${platform.cls}`}>{platform.abbr}</span>
          <span className="platform-row-name">{platform.label}</span>
          <ChevronRight size={16} className="platform-chevron" />
        </div>

        <div className="platform-row-input">
          <input
            className="form-input"
            type="url"
            placeholder={platform.placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={saved || loading}
            onKeyDown={(e) => e.key === 'Enter' && !saved && handleSubmit()}
          />
        </div>

        <div className="platform-row-actions">
          {loading ? (
            <Loader2 size={20} className="spinner" />
          ) : saved ? (
            <>
              {renderVerificationBadge()}
              {canVerify && (
                <button
                  className="btn btn-sm btn-outline verify-btn"
                  onClick={() => setShowVerifyModal(true)}
                >
                  Verify
                </button>
              )}
              <CheckCircle2 size={24} className="check-saved" />
              <button className="btn-icon-ghost" onClick={handleDelete} title="Remove">
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <button className="btn btn-outline btn-sm" onClick={handleSubmit}>
              Submit
            </button>
          )}
        </div>
      </div>

      {showVerifyModal && (
        <VerificationModal
          platform={platform}
          profileUrl={evidence.profileUrl}
          onClose={() => setShowVerifyModal(false)}
          onVerified={() => {
            setShowVerifyModal(false);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
