import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ role }: { role: 'admin' | 'voter' }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to={`/${role}/login`} replace />;
  }

  // Admin route accepts both 'admin' and 'super_admin' roles
  if (role === 'admin' && user.role !== 'admin' && user.role !== 'super_admin') {
    return <Navigate to="/admin/login" replace />;
  }

  if (role === 'voter' && user.role !== 'voter') {
    return <Navigate to="/voter/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
