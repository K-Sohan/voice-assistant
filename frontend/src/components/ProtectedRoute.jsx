import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-dark-500" />
            <div className="absolute inset-0 rounded-full border-4 border-t-violet border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-gray-500 text-sm">Authenticating…</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}