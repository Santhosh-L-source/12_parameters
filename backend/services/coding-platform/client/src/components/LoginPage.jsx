import { useState } from 'react';
import { LogIn, UserPlus, KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, register as apiRegister, forgotPassword as apiForgotPassword } from '../api';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    rollNumber: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function switchMode(newMode) {
    setMode(newMode);
    setForm((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const result = await apiLogin({
          rollNumber: form.rollNumber.trim(),
          password: form.password,
        });
        login(result.token, result.student);
        toast.success('Logged in successfully');
      } else if (mode === 'register') {
        if (!form.name || !form.email) {
          toast.error('Please fill all fields');
          setLoading(false);
          return;
        }
        await apiRegister({
          rollNumber: form.rollNumber.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        toast.success('Account created successfully! Please sign in.');
        switchMode('login');
      } else if (mode === 'forgot') {
        if (!form.rollNumber || !form.email || !form.password) {
          toast.error('Please fill all required fields');
          setLoading(false);
          return;
        }
        if (form.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (form.password !== form.confirmPassword) {
          toast.error('New passwords do not match');
          setLoading(false);
          return;
        }

        const res = await apiForgotPassword({
          rollNumber: form.rollNumber.trim(),
          email: form.email.trim(),
          newPassword: form.password,
        });
        toast.success(res.message || 'Password reset successfully! Please sign in.');
        switchMode('login');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card card">
        <div className="card-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
          <div>
            <h2>
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h2>
            <p>
              {mode === 'login' && 'Sign in with your college roll number'}
              {mode === 'register' && 'Register with your college details'}
              {mode === 'forgot' && 'Verify your roll number & email to set a new password'}
            </p>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-stack">
              <div className="form-group">
                <label className="form-label">Roll Number</label>
                <input
                  className="form-input"
                  placeholder="e.g. 24CS212"
                  value={form.rollNumber}
                  onChange={(e) => update('rollNumber', e.target.value)}
                  required
                />
              </div>

              {mode === 'register' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Santhosh L"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="e.g. santhosh@college.edu"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {mode === 'forgot' && (
                <div className="form-group">
                  <label className="form-label">Registered Email</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="e.g. santhosh@college.edu"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <div className={mode === 'login' ? 'form-label-row' : undefined}>
                  <label className="form-label" style={mode === 'login' ? { marginBottom: 0 } : undefined}>
                    {mode === 'forgot' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => switchMode('forgot')}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  className="form-input"
                  type="password"
                  placeholder={mode === 'forgot' ? 'Enter new password (min 6 chars)' : 'Enter password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {mode === 'forgot' && (
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Re-enter new password"
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 20 }}
            >
              {loading ? (
                <Loader2 size={16} className="spinner" />
              ) : mode === 'login' ? (
                <LogIn size={16} />
              ) : mode === 'register' ? (
                <UserPlus size={16} />
              ) : (
                <KeyRound size={16} />
              )}
              {loading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Register'
                : 'Reset Password'}
            </button>
          </form>

          <div className="login-switch">
            {mode === 'login' && (
              <p>
                Don't have an account?{' '}
                <button className="link-btn" onClick={() => switchMode('register')}>
                  Register
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p>
                Already have an account?{' '}
                <button className="link-btn" onClick={() => switchMode('login')}>
                  Sign In
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Remember your password?{' '}
                <button className="link-btn" onClick={() => switchMode('login')}>
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
