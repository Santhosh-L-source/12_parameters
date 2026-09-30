import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUserRole } from '../utils/auth';

/**
 * Role-Based Protected Route Component
 * 
 * Props:
 * - allowedRoles: Array of allowed roles (e.g. ['student'], ['mentor'], ['admin'])
 * - children: The component to render if authorized
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const role = getUserRole();

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // Redirect to the user's appropriate default dashboard
    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (role === 'mentor') {
      return <Navigate to="/mentor" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
