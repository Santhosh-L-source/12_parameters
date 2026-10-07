export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://hope-backend-psi.vercel.app' : 'http://localhost:3005');

// Get auth token from localStorage
const getAuthToken = () => localStorage.getItem('token');

// API request wrapper
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }

    const text = await response.text();
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, message: text || `Request failed (${response.status})` };
    }
    return { success: true, message: text };
  } catch (err) {
    console.warn(`[API] Error querying ${endpoint}:`, err.message);
    return { success: false, error: 'NetworkError', message: err.message || 'Network request failed' };
  }
};


// File Upload API (PDF & JPG/JPEG/PNG)
export const uploadAPI = {
  uploadFile: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });
    return response.json();
  },
};

// Auth API
export const authAPI = {
  login: async (username, password) => {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
  },
};

// Student API
export const studentAPI = {
  getDashboard: () => apiRequest('/api/student/dashboard'),
  getProfile: () => apiRequest('/api/student/profile'),
  getScores: () => apiRequest('/api/student/scores'),
  getMarks: () => apiRequest('/api/student/marks'),
};

// Module APIs
export const moduleAPI = {
  // Hundred Days
  getHundredDays: (studentId) => apiRequest(`/api/hundred-days/student/${studentId}`),
  getHundredDaysMarks: (studentId) => apiRequest(`/api/hundred-days/marks/${studentId}`),
  submitHundredDays: (data) => apiRequest('/api/hundred-days/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Language
  getLanguageEvidence: (studentId) => apiRequest(`/api/language/student/${studentId}`),
  getLanguageMarks: (studentId) => apiRequest(`/api/language/marks/${studentId}`),
  submitLanguage: (data) => apiRequest('/api/language/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteLanguageEvidence: (id) => apiRequest(`/api/language/evidence/${id}`, {
    method: 'DELETE',
  }),

  // GATE
  getGateEvidence: (studentId) => apiRequest(`/api/gate/student/${studentId}`),
  getGateMarks: (studentId) => apiRequest(`/api/gate/marks/${studentId}`),
  submitGate: (data) => apiRequest('/api/gate/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteGateEvidence: (id) => apiRequest(`/api/gate/evidence/${id}`, {
    method: 'DELETE',
  }),

  // Competition
  getCompetitionEvidence: (studentId) => apiRequest(`/api/competition/student/${studentId}`),
  getCompetitionMarks: (studentId) => apiRequest(`/api/competition/marks/${studentId}`),

  submitCompetition: (data) => apiRequest('/api/competition/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteCompetitionEvidence: (id) => apiRequest(`/api/competition/evidence/${id}`, {
    method: 'DELETE',
  }),

  // Internship
  getInternshipEvidence: (studentId) => apiRequest(`/api/internship/student/${studentId}`),
  getInternshipMarks: (studentId) => apiRequest(`/api/internship/marks/${studentId}`),
  submitInternship: (data) => apiRequest('/api/internship/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteInternshipEvidence: (id) => apiRequest(`/api/internship/evidence/${id}`, {
    method: 'DELETE',
  }),

  // Certificate
  getCertificateEvidence: (studentId) => apiRequest(`/api/certificate/student/${studentId}`),
  getCertificateMarks: (studentId) => apiRequest(`/api/certificate/marks/${studentId}`),
  submitCertificate: (data) => apiRequest('/api/certificate/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteCertificateEvidence: (id) => apiRequest(`/api/certificate/evidence/${id}`, {
    method: 'DELETE',
  }),

  // Aptitude & Communication
  getAptitudeEvidence: (studentId) => apiRequest(`/api/aptitude-communication/student/${studentId}`),
  getAptitudeMarks: (studentId) => apiRequest(`/api/aptitude-communication/marks/${studentId}`),
  submitAptitude: (data) => apiRequest('/api/aptitude-communication/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteAptitudeEvidence: (id) => apiRequest(`/api/aptitude-communication/evidence/${id}`, {
    method: 'DELETE',
  }),


  // Coding Problems
  getCodingProblemsEvidence: (studentId) => apiRequest(`/api/coding-problems/student/${studentId}`),
  getCodingProblemsMarks: (studentId) => apiRequest(`/api/coding-problems/marks/${studentId}`),
  submitCodingProblems: (data) => apiRequest('/api/coding-problems/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  verifyCodingProblemsOwnership: (data) => apiRequest('/api/coding-problems/verify-ownership', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  removeCodingProblems: (data) => apiRequest('/api/coding-problems/remove', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // CP Rating
  getCPRatingEvidence: (studentId) => apiRequest(`/api/cp-rating/student/${studentId}`),
  getCPRatingMarks: (studentId) => apiRequest(`/api/cp-rating/marks/${studentId}`),
  submitCPRating: (data) => apiRequest('/api/cp-rating/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  syncCPRatingFromCodingPlatforms: () => apiRequest('/api/cp-rating/sync-from-coding-platforms', {
    method: 'POST',
  }),

  // Open Source
  getOpenSourceEvidence: (studentId) => apiRequest(`/api/open-source/student/${studentId}`),
  getOpenSourceMarks: (studentId) => apiRequest(`/api/open-source/marks/${studentId}`),
  submitOpenSource: (data) => apiRequest('/api/open-source/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  verifyOpenSourceOwnership: (data) => apiRequest('/api/open-source/verify-ownership', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  syncOpenSource: () => apiRequest('/api/open-source/sync', {
    method: 'POST',
  }),
  deleteOpenSource: (id) => apiRequest(`/api/open-source/${id}`, {
    method: 'DELETE',
  }),

  // Monthly Coding
  getMonthlyCodingEvidence: (studentId) => apiRequest(`/api/monthly-coding/student/${studentId}`),
  getMonthlyCodingMarks: (studentId) => apiRequest(`/api/monthly-coding/marks/${studentId}`),
  submitMonthlyCoding: (data) => apiRequest('/api/monthly-coding/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Project / Publication / Patent
  getProjectPubPatentEvidence: (studentId) => apiRequest(`/api/project-pub-patent/student/${studentId}`),
  getProjectPubPatentMarks: (studentId) => apiRequest(`/api/project-pub-patent/marks/${studentId}`),
  submitProjectPubPatent: (data) => apiRequest('/api/project-pub-patent/submit', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteProjectPubPatentEvidence: (id) => apiRequest(`/api/project-pub-patent/evidence/${id}`, {
    method: 'DELETE',
  }),

};

// Mentor Verification APIs
export const mentorAPI = {
  // Hundred Days
  getPendingHundredDays: () => apiRequest('/api/hundred-days/pending'),
  getHundredDaysCohort: () => apiRequest('/api/hundred-days/cohort'),
  batchEvaluateHundredDays: (data) => apiRequest('/api/hundred-days/batch-evaluate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  evaluateHundredDays: (data) => apiRequest('/api/hundred-days/evaluate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  verifyHundredDays: (id, action, rejection_reason = null) => apiRequest(`/api/hundred-days/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Language
  getPendingLanguage: () => apiRequest('/api/language/pending'),
  verifyLanguage: (id, action, rejection_reason = null) => apiRequest(`/api/language/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // GATE
  getPendingGate: () => apiRequest('/api/gate/pending'),
  verifyGate: (id, action, rejection_reason = null) => apiRequest(`/api/gate/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Competition
  getPendingCompetition: () => apiRequest('/api/competition/pending'),
  verifyCompetition: (id, action, rejection_reason = null) => apiRequest(`/api/competition/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Internship
  getPendingInternship: () => apiRequest('/api/internship/pending'),
  verifyInternship: (id, action, rejection_reason = null) => apiRequest(`/api/internship/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Certificate
  getPendingCertificate: () => apiRequest('/api/certificate/pending'),
  verifyCertificate: (id, action, rejection_reason = null) => apiRequest(`/api/certificate/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Aptitude & Communication
  getPendingAptitude: () => apiRequest('/api/aptitude-communication/pending'),
  verifyAptitude: (id, action, rejection_reason = null) => apiRequest(`/api/aptitude-communication/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Coding Problems
  getPendingCodingProblems: () => apiRequest('/api/coding-problems/pending'),
  verifyCodingProblems: (id, action, rejection_reason = null) => apiRequest(`/api/coding-problems/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // CP Rating
  getPendingCPRating: () => apiRequest('/api/cp-rating/pending'),
  verifyCPRating: (id, action, rejection_reason = null) => apiRequest(`/api/cp-rating/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Open Source
  getPendingOpenSource: () => apiRequest('/api/open-source/pending'),
  verifyOpenSource: (id, action, rejection_reason = null) => apiRequest(`/api/open-source/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Monthly Coding
  getPendingMonthlyCoding: () => apiRequest('/api/monthly-coding/pending'),
  assignMonthlyCodingScore: (data) => apiRequest('/api/monthly-coding/mentor-assign', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  verifyMonthlyCoding: (id, action, rejection_reason = null) => apiRequest(`/api/monthly-coding/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Project / Publication / Patent
  getPendingProjectPubPatent: () => apiRequest('/api/project-pub-patent/pending'),
  verifyProjectPubPatent: (id, action, rejection_reason = null) => apiRequest(`/api/project-pub-patent/${id}/verify`, {
    method: 'POST',
    body: JSON.stringify({ action, rejection_reason }),
  }),

  // Mentor Mentees & Cohort Overview
  getOverview: () => apiRequest('/api/mentor/overview'),
  getMyStudents: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/api/mentor/my-students${query ? `?${query}` : ''}`);
  },
  getStudentDetail: (studentId) => apiRequest(`/api/mentor/student-detail/${studentId}`),
};

// Admin API
export const adminAPI = {
  getStudentScores: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/api/admin/student-scores${query ? `?${query}` : ''}`);
  },
  getMentors: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/api/admin/mentors${query ? `?${query}` : ''}`);
  },
  assignMentor: (student_ids, mentor_id) => apiRequest('/api/admin/assign-mentor', {
    method: 'POST',
    body: JSON.stringify({ student_ids, mentor_id }),
  }),
  autoAssignDepartments: (data = {}) => apiRequest('/api/admin/auto-assign-departments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  uploadMonthlyCoding: (formData) => {
    const token = getAuthToken();
    return fetch(`${API_BASE_URL}/api/admin/upload-monthly-coding`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    }).then(res => res.json());
  },
  getImportJobStatus: (jobId) => apiRequest(`/api/admin/import-jobs/${jobId}`),
  exportScores: async (params = {}) => {
    const token = getAuthToken();
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/api/admin/export/scores${query ? `?${query}` : ''}`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      }
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(err.error || 'Failed to download Excel file');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Student_Scores_${params.semester ? `Semester_${params.semester}` : 'All_Students'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  },
  emailScoresExport: (data) => apiRequest('/api/admin/export/scores/email', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export default apiRequest;
