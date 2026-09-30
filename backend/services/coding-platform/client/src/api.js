const BASE = '/api/evidence/coding';
const AUTH_BASE = '/api/auth';
const VERIFY_BASE = '/api/verification';

function getToken() {
  return localStorage.getItem('hope_token');
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Request failed');
  return data;
}

// Auth
export function register(payload) {
  return request(`${AUTH_BASE}/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request(`${AUTH_BASE}/login`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(payload) {
  return request(`${AUTH_BASE}/forgot-password`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMe() {
  return request(`${AUTH_BASE}/me`);
}

// Evidence
export function fetchSync(payload) {
  return request(`${BASE}/fetch-sync`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getEvidence(id) {
  return request(`${BASE}/${id}`);
}

export function getStudentEvidence(studentId) {
  return request(`${BASE}/student/${encodeURIComponent(studentId)}`);
}

export function refetchEvidence(id) {
  return request(`${BASE}/${id}/refetch`, { method: 'POST' });
}

export function updateCounts(id, counts) {
  return request(`${BASE}/${id}/update-counts`, {
    method: 'PUT',
    body: JSON.stringify(counts),
  });
}

export function deleteEvidence(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' });
}

// Verification
export function getVerificationPlatforms() {
  return request(`${VERIFY_BASE}/platforms`);
}

export function startVerification(payload) {
  return request(`${VERIFY_BASE}/start`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function checkVerification(attemptId) {
  return request(`${VERIFY_BASE}/check`, {
    method: 'POST',
    body: JSON.stringify({ attemptId }),
  });
}

export function getVerificationStatus(platform) {
  return request(`${VERIFY_BASE}/status/${platform}`);
}

export function removeVerifiedProfile(platform) {
  return request(`${VERIFY_BASE}/remove/${platform}`, { method: 'POST' });
}

export function getHealth() {
  return request('/health');
}
