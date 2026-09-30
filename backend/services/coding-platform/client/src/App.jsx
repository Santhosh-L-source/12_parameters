import { Code2, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import StudentDashboard from './components/StudentDashboard';

function AppContent() {
  const { isLoggedIn, student, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>
          <Code2 size={22} />
          <span>Hope Project</span> — Coding Evidence
        </h1>
        {isLoggedIn && (
          <div className="header-user">
            <span className="header-roll">{student.rollNumber}</span>
            <span className="header-name">{student.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {isLoggedIn ? <StudentDashboard /> : <LoginPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
