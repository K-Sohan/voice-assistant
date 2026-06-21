import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute  from './components/ProtectedRoute.jsx';
import AppLayout       from './components/AppLayout.jsx';
import Login        from './pages/Login.jsx';
import Dashboard    from './pages/Dashboard.jsx';
import Profile      from './pages/Profile.jsx';
import Settings     from './pages/Settings.jsx';
import AuthCallback from './pages/AuthCallback.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"         element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

         {/* Protected — shared layout keeps CDAssistant alive across pages */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile"   element={<Profile />} />
            <Route path="/settings"  element={<Settings />} />
          </Route>
          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}