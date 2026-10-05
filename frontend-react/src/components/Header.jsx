import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { getUser, getUserRole } from '../utils/auth';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const role = getUserRole();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
  };

  const isStudentDash = location.pathname === '/dashboard' || location.pathname.startsWith('/modules');
  const isMentorDash = location.pathname.startsWith('/mentor');
  const isAdminDash = location.pathname === '/admin';

  const handleHomeClick = () => {
    setMobileMenuOpen(false);
    if (role === 'admin') navigate('/admin');
    else if (role === 'mentor') navigate('/mentor');
    else navigate('/dashboard');
  };

  const navigateTo = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="header">
      <div className="header-main-bar">
        <div className="logo" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
          <span className="logo-icon">📊</span>
          <span className="logo-title">
            Hope Project <span className="logo-text">— Tracker</span>
          </span>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className={`header-right ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {user && (
          <div className="user-badge-header">
            <span className="user-name" title={user.name || user.id_number}>
              {user.name ? user.name.split(' (')[0] : (user.id_number || 'User')}
            </span>
            <span className={`role-tag ${role}`}>{role?.toUpperCase()}</span>
          </div>
        )}

        <button className="logout-btn" onClick={handleLogout}>
          <span>🚪</span> Logout
        </button>
      </div>
    </header>
  );
};

export default Header;

