import React from "react";
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user)
    return <Navigate to='/login' replace state={{ from: loc.pathname }} />;
  if (role && user.role !== role)
    return (
      <Navigate
        to={
          user.role === 'patient' ? '/patient/dashboard' : '/clinic/dashboard'
        }
        replace
      />
    );
  return children;
}
