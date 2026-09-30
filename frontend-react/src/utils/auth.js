// Authentication utilities

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

export const getStudent = () => {
  const student = localStorage.getItem('student') || localStorage.getItem('user');
  return student ? JSON.parse(student) : null;
};

export const getUser = () => {
  const user = localStorage.getItem('user') || localStorage.getItem('student');
  return user ? JSON.parse(user) : null;
};

export const getUserRole = () => {
  const user = getUser();
  return user?.role || 'student';
};

export const setAuth = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('student', JSON.stringify(user));
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('student');
  localStorage.removeItem('user');
};
