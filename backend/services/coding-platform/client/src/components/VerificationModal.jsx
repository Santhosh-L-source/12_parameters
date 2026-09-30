import { useState } from 'react';
import { X, Copy, Check, Loader2, ShieldCheck, ShieldAlert, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { startVerification, checkVerification } from '../api';

const STEP_TITLES = ['Start Verification', 'Add Verification Code', 'Verify Profile'];

export default function VerificationModal({ platform, profileUrl, onClose, onVerified }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [token, setToken] = useState('');
  const [instructions, setInstructions] = useState([]);
  const [fieldName, setFieldName] = useState('');
  const [expiresIn, setExpiresIn] = useState(10);
  const [result, setResult] = useState(null); // 'success' | 'failed'
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleStart() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await startVerification({ platform: platform.value, profileUrl });
      setAttemptId(res.attemptId);
      setToken(res.token);
      setInstructions(res.instructions || []);
      setFieldName(res.fieldName || 'profile');
      setExpiresIn(res.expiresInMinutes);
      setStep(2);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await checkVerification(attemptId);
      if (res.verified) {
        setResult('success');
        onVerified?.();
      }
    } catch (err) {
      setResult('failed');
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function renderStepIndicator() {
    return (
      <div className="verify-steps">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`verify-step-dot ${step >= s ? 'active' : ''} ${result === 'success' ? 'done' : ''}`}>
            {s}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal verify-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="verify-step-label">
              {result ? 'Result' : `STEP ${step} / 3`}
            </p>
            <h3>{result === 'success' ? 'Verification Complete' : result === 'failed' ? 'Verification Failed' : STEP_TITLES[step - 1]}</h3>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {renderStepIndicator()}

          {/* STEP 1 */}
          {step === 1 && !result && (
            <div className="verify-content">
              <p className="verify-desc">
                Verify your <strong>{platform.label}</strong> profile to confirm it belongs to you.
              </p>
              <div className="verify-checklist">
                <p><Check size={16} className="check-icon" /> Access to your {platform.label} account</p>
                <p><Check size={16} className="check-icon" /> Ability to edit your profile</p>
              </div>
              <p className="verify-note">
                You will need to temporarily add a verification code to your profile.
                You can remove it after verification.
              </p>
              {errorMsg && <p className="verify-error">{errorMsg}</p>}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && !result && (
            <div className="verify-content">
              <p className="verify-desc">
                Edit your {platform.label} <strong>{fieldName}</strong> and add this code:
              </p>
              <div className="verify-token-box">
                <code className="verify-token">{token}</code>
                <button className="btn btn-sm btn-outline" onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              {instructions.length > 0 && (
                <div className="verify-instructions">
                  <p className="verify-instructions-title">How to add:</p>
                  <ol>
                    {instructions.map((inst, i) => (
                      <li key={i}>{inst}</li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="verify-note">
                This code expires in {expiresIn} minutes. You can remove it after verification.
              </p>
              {errorMsg && <p className="verify-error">{errorMsg}</p>}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && !result && (
            <div className="verify-content">
              <p className="verify-desc">
                Make sure you have <strong>saved</strong> your {platform.label} profile after adding the verification code.
              </p>
              <div className="verify-token-box" style={{ opacity: 0.7 }}>
                <code className="verify-token">{token}</code>
              </div>
              <p className="verify-note">
                Click the button below to verify. We will check your profile for the code.
              </p>
              {errorMsg && <p className="verify-error">{errorMsg}</p>}
            </div>
          )}

          {/* SUCCESS */}
          {result === 'success' && (
            <div className="verify-content verify-result">
              <div className="verify-result-icon success">
                <ShieldCheck size={48} />
              </div>
              <h3>{platform.label} profile verified</h3>
              <p>Your profile has been successfully linked to your account.</p>
            </div>
          )}

          {/* FAILED */}
          {result === 'failed' && (
            <div className="verify-content verify-result">
              <div className="verify-result-icon failed">
                <ShieldAlert size={48} />
              </div>
              <h3>Verification failed</h3>
              <p>{errorMsg || 'We could not find the verification code on your profile. Make sure you added the exact code, saved your profile, and try again.'}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 1 && !result && (
            <button className="btn btn-primary" onClick={handleStart} disabled={loading}>
              {loading ? <Loader2 size={16} className="spinner" /> : <ChevronRight size={16} />}
              Start Verification
            </button>
          )}
          {step === 2 && !result && (
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              <ChevronRight size={16} />
              I've added the code
            </button>
          )}
          {step === 3 && !result && (
            <button className="btn btn-primary" onClick={handleVerify} disabled={loading}>
              {loading ? <Loader2 size={16} className="spinner" /> : <ShieldCheck size={16} />}
              {loading ? 'Verifying...' : `Verify ${platform.label} Profile`}
            </button>
          )}
          {result === 'success' && (
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          )}
          {result === 'failed' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => { setResult(null); setErrorMsg(''); setStep(1); }}>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
