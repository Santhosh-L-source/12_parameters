import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { setAuth, isAuthenticated, getUserRole } from '../utils/auth';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [roleMode, setRoleMode] = useState('student'); // 'student', 'mentor', 'admin'
  const [rollNumber, setRollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      const role = getUserRole();
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'mentor') {
        navigate('/mentor');
      } else {
        navigate('/dashboard');
      }
    }
  }, [navigate]);

  const switchRole = (role) => {
    setRoleMode(role);
    setRollNumber('');
    setPassword('');
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!rollNumber || !password) {
      setError('Please enter your username / ID and password');
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login(rollNumber, password);

      if (data.success) {
        const user = data.user || data.student;
        setAuth(data.token, user);
        
        // Clean, professional welcome message
        const displayName = user.name ? user.name.split(' (')[0] : (user.role === 'admin' ? 'Admin' : 'Student');
        setSuccess(`Welcome, ${displayName}! Redirecting...`);

        setTimeout(() => {
          if (user.role === 'admin') {
            navigate('/admin');
          } else if (user.role === 'mentor') {
            navigate('/mentor');
          } else {
            navigate('/dashboard');
          }
        }, 500);
      } else {
        setError(data.message || 'Invalid credentials. Please check your username and password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">📊</span>
          <span>
            Hope Project <span className="logo-text">— Achievement Tracker</span>
          </span>
        </div>
      </header>

      <div className="main-content">
        <div className="login-card">
          <div className="welcome-text">
            <h1>
              {roleMode === 'admin' && '⚙️ Admin Portal Sign In'}
              {roleMode === 'mentor' && '👨‍🏫 Mentor Portal Sign In'}
              {roleMode === 'student' && '🎓 Student Sign In'}
            </h1>
            <p>
              {roleMode === 'admin' && 'Supervise verification, batch assessments & academic matrix'}
              {roleMode === 'mentor' && 'Review and verify department student achievements'}
              {roleMode === 'student' && 'Sign in with your student credentials'}
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="role-switcher">
            <button
              type="button"
              className={`role-tab ${roleMode === 'student' ? 'active' : ''}`}
              onClick={() => switchRole('student')}
            >
              Student
            </button>
            <button
              type="button"
              className={`role-tab ${roleMode === 'mentor' ? 'active' : ''}`}
              onClick={() => switchRole('mentor')}
            >
              Mentor
            </button>
            <button
              type="button"
              className={`role-tab ${roleMode === 'admin' ? 'active' : ''}`}
              onClick={() => switchRole('admin')}
            >
              Admin
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="rollNumber">
                {roleMode === 'student' ? 'Roll Number' : 'Username / Staff ID'}
              </label>
              <input
                type="text"
                id="rollNumber"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder={roleMode === 'student' ? 'e.g. 24CS360' : 'e.g. MENTOR_CSE or ADMIN'}
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                {roleMode === 'student' ? 'Password (Register Number)' : 'Password'}
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={roleMode === 'student' ? 'e.g. 312324104001 or Roll Number' : 'Enter password'}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Authenticating...' : <><span>→</span> Sign In as {roleMode.toUpperCase()}</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
