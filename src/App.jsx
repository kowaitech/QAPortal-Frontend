import React from 'react';
import { Routes, Route } from 'react-router-dom';
const Home = React.lazy(() => import('./pages/Home'));
const Register = React.lazy(() => import('./pages/Register'));
const Login = React.lazy(() => import('./pages/Login'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const TestSchedule = React.lazy(() => import('./pages/admin/TestSchedule'));
const StaffDashboard = React.lazy(() => import('./pages/staff/StaffDashboard'));
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard'));
const Tests = React.lazy(() => import('./pages/student/Tests'));
const TakeTest = React.lazy(() => import('./pages/student/TakeTest'));
import Protected from './utils/Protected';
import Navbar from './components/Navbar';

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container-page py-6">
        <React.Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
          <Route path="/staff" element={<Protected roles={['staff']}><StaffDashboard /></Protected>} />
          <Route path="/student" element={<Protected roles={['student']}><StudentDashboard /></Protected>} />
          <Route path="/admin/tests" element={<Protected roles={['admin']}><TestSchedule /></Protected>} />
          <Route path="/student/tests" element={<Protected roles={['student']}><Tests /></Protected>} />
          <Route path="/student/take/:id" element={<Protected roles={['student']}><TakeTest /></Protected>} />
        </Routes>
        </React.Suspense>
      </main>
    </>
  );
}
