import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from './authStore';
export default function Protected({ children, roles=[] }){
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
