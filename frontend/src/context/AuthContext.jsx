import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Called on mount and after profile saves to keep user state fresh
  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('va_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      if (data.success) setUser(data.user);
    } catch {
      localStorage.removeItem('va_token');
      localStorage.removeItem('va_user');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Called after successful login (local or OAuth callback)
  const login = (token, userData) => {
    localStorage.setItem('va_token', token);
    localStorage.setItem('va_user', JSON.stringify(userData));
    setUser(userData);
  };

  // Called on logout button
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — we clear the token regardless
    } finally {
      localStorage.removeItem('va_token');
      localStorage.removeItem('va_user');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};