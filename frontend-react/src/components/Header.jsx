import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { getUser, getUserRole } from '../utils/auth';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const role = getUserRole();

  const handleLogout = () => {
    authAPI.logout();
    navigate('/login');
  };

  const isStudentDash = location.pathname === '/dashboard' || location.pathname.startsWith('/modules');
  const isMentorDash = location.pathname.startsWith('/mentor');
  const isAdminDash = location.pathname === '/admin';

  const handleHomeClick = () => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'mentor') navigate('/mentor');
    else navigate('/dashboard');
  };

  return (
    <header className="header">
      <div className="logo" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <span>📊</span>
        <span>
          Hope Project <span className="logo-text">— Achievement Tracker</span>
        </span>
      </div>

      <div className="header-right">
        {/* Strictly Role-Restricted Navigation */}
        {role === 'student' && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/dashboard');
            }}
            className={`nav-link ${isStudentDash ? 'active' : ''}`}
          >
            🎓 Student Portal
          </a>
        )}

        {role === 'mentor' && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/mentor');
            }}
            className={`nav-link ${isMentorDash ? 'active' : ''}`}
          >
            👨‍🏫 Mentor Portal
          </a>
        )}

        {role === 'admin' && (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/admin');
            }}
            className={`nav-link ${isAdminDash ? 'active' : ''}`}
          >
            ⚙️ Admin Control Center
          </a>
        )}

        {user && (
          <div className="user-badge-header">
            <span className="user-name">{user.name || user.id_number}</span>
            <span className={`role-tag ${role}`}>{role.toUpperCase()}</span>
          </div>
        )}

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Header;
