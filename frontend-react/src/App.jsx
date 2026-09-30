import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HundredDays from './pages/modules/HundredDays';
import Language from './pages/modules/Language';
import Gate from './pages/modules/Gate';
import Competition from './pages/modules/Competition';
import Internship from './pages/modules/Internship';
import Certificate from './pages/modules/Certificate';
import Aptitude from './pages/modules/Aptitude';
import CodingProblems from './pages/modules/CodingProblems';
import CpRating from './pages/modules/CpRating';
import OpenSource from './pages/modules/OpenSource';
import MonthlyCoding from './pages/modules/MonthlyCoding';
import ProjectPubPatent from './pages/modules/ProjectPubPatent';

import MentorDashboard from './pages/MentorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HundredDaysReview from './pages/mentor/HundredDaysReview';
import LanguageReview from './pages/mentor/LanguageReview';
import GateReview from './pages/mentor/GateReview';
import CompetitionReview from './pages/mentor/CompetitionReview';
import InternshipReview from './pages/mentor/InternshipReview';
import CertificateReview from './pages/mentor/CertificateReview';
import AptitudeReview from './pages/mentor/AptitudeReview';
import CodingProblemsReview from './pages/mentor/CodingProblemsReview';
import CpRatingReview from './pages/mentor/CpRatingReview';
import OpenSourceReview from './pages/mentor/OpenSourceReview';
import MonthlyCodingReview from './pages/mentor/MonthlyCodingReview';
import ProjectPubPatentReview from './pages/mentor/ProjectPubPatentReview';

import ProtectedRoute from './components/ProtectedRoute';
import { isAuthenticated, getUserRole } from './utils/auth';
import './App.css';

const HomeRedirect = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  const role = getUserRole();
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'mentor') return <Navigate to="/mentor" replace />;
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* Student Portal Routes (Only Accessible by Student / Admin) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/hundred-days"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <HundredDays />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/language"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Language />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/gate"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Gate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/competition"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Competition />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/internship"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Internship />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/certificate"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Certificate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/aptitude"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <Aptitude />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/coding-problems"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <CodingProblems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/cp-rating"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <CpRating />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/open-source"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <OpenSource />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/monthly-coding"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <MonthlyCoding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/project"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <ProjectPubPatent />
            </ProtectedRoute>
          }
        />
        <Route
          path="/modules/project-pub-patent"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <ProjectPubPatent />
            </ProtectedRoute>
          }
        />

        {/* Mentor Routes (Only Accessible by Mentor / Admin) */}
        <Route
          path="/mentor"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/hundred-days"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <HundredDaysReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/language"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <LanguageReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/gate"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <GateReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/competition"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <CompetitionReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/internship"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <InternshipReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/certificate"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <CertificateReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/aptitude"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <AptitudeReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/coding-problems"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <CodingProblemsReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/cp-rating"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <CpRatingReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/open-source"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <OpenSourceReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/monthly-coding"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MonthlyCodingReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/project"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <ProjectPubPatentReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/review/project-pub-patent"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <ProjectPubPatentReview />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes (Strictly Accessible by Admin Only) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
