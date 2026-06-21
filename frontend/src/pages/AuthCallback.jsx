import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const { login }      = useAuth();
  const handled        = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      const msg = decodeURIComponent(error);
      navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
      return;
    }
    if (!token) {
      navigate('/login?error=No+authentication+token+was+received.', { replace: true });
      return;
    }

    localStorage.setItem('va_token', token);

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!data.success) {
          localStorage.removeItem('va_token');
          navigate('/login?error=Failed+to+load+user+profile.', { replace: true });
          return;
        }

        // ── Verify the Google account matches what was typed before redirect ──
        let expectedEmail = null;
        try { expectedEmail = sessionStorage.getItem('expectedAuthEmail'); } catch {}
        try { sessionStorage.removeItem('expectedAuthEmail'); } catch {}

        if (expectedEmail && data.user.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
          localStorage.removeItem('va_token');
          const msg = `You signed in with ${data.user.email}, but entered ${expectedEmail}. Please use the matching Google account, or continue with ${data.user.email} instead.`;
          navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
          return;
        }

        login(token, data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('va_token');
        navigate('/login?error=Authentication+failed.+Please+try+again.', { replace: true });
      });
  }, []);

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-dark-500" />
          <div className="absolute inset-0 rounded-full border-4 border-t-violet border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full bg-violet/10 flex items-center justify-center text-xl">
            🎙️
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-medium">Completing sign-in…</p>
          <p className="text-gray-500 text-sm mt-1">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}