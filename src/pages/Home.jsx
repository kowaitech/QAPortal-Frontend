import React from 'react';
import { useAuthStore } from '../utils/authStore';
import AdminDashboard from './admin/AdminDashboard';
import StaffDashboard from './staff/StaffDashboard';
import StudentDashboard from './student/StudentDashboard';

export default function Home() {
  const user = useAuthStore(state => state.user);

  if (!user) {
    return (
      <div className="text-center p-10">
        <h1 className="text-2xl font-bold mb-4">Welcome to Interview Portal</h1>
        <p className="text-gray-600">Please login or register to continue.</p>
      </div>
    );
  }

  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'staff') return <StaffDashboard />;
  if (user.role === 'student') return <StudentDashboard />;

  return <div className="p-6">Unknown role</div>;
}
