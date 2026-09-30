import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const TOKEN_KEY = 'hope_token';
const STUDENT_KEY = 'hope_student';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [student, setStudent] = useState(() => {
    const saved = localStorage.getItem(STUDENT_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback((tokenValue, studentData) => {
    localStorage.setItem(TOKEN_KEY, tokenValue);
    localStorage.setItem(STUDENT_KEY, JSON.stringify(studentData));
    setToken(tokenValue);
    setStudent(studentData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STUDENT_KEY);
    setToken(null);
    setStudent(null);
  }, []);

  const isLoggedIn = !!token && !!student;

  return (
    <AuthContext.Provider value={{ token, student, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
