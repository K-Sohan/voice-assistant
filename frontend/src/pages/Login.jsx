import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Form state ────────────────────────────────────────────────────────────
  const AUTH_STEP = {
    EMAIL: 'email', SIGNUP: 'signup', SIGNIN: 'signin',
    GOOGLE_ACCOUNT: 'google', MICROSOFT_ACCOUNT: 'microsoft', NOT_FOUND_SIGNIN: 'not_found_signin',
  };
  const [authStep, setAuthStep] = useState(AUTH_STEP.EMAIL);
  const [intent, setIntent]     = useState('signup');
  const [email, setEmail]       = useState('');
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── Redirect if already logged in ───────────────────────────────────────
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  // ── Form handlers ─────────────────────────────────────────────────────────
  const isValidEmail = (e) => /^\S+@\S+\.\S+$/.test(e.trim());

  const resetToEmailStep = () => {
    setAuthStep(AUTH_STEP.EMAIL);
    setError(''); setPassword(''); setName('');
  };

  const goToSignupFresh = () => {
    setIntent('signup'); setEmail(''); setPassword(''); setName(''); setError('');
    setAuthStep(AUTH_STEP.EMAIL);
  };

  const handleEmailContinue = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    setChecking(true);
    try {
      const { data } = await api.post('/auth/check-email', { email: email.trim().toLowerCase() });
      if (data.exists) {
        if (data.authProvider === 'google')      setAuthStep(AUTH_STEP.GOOGLE_ACCOUNT);
        else if (data.authProvider === 'microsoft') setAuthStep(AUTH_STEP.MICROSOFT_ACCOUNT);
        else setAuthStep(AUTH_STEP.SIGNIN);
      } else {
        setAuthStep(intent === 'signin' ? AUTH_STEP.NOT_FOUND_SIGNIN : AUTH_STEP.SIGNUP);
      }
    } catch {
      setError('Something went wrong checking that email. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleSigninSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.success) { login(data.token, data.user); navigate('/dashboard'); }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally { setLoading(false); }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/register', { name: name.trim(), email, password });
      if (data.success) { login(data.token, data.user); navigate('/dashboard'); }
    } catch (err) {
      const msg      = err.response?.data?.message || 'Something went wrong. Please try again.';
      const provider = err.response?.data?.authProvider;
      if (provider === 'google')      setAuthStep(AUTH_STEP.GOOGLE_ACCOUNT);
      else if (provider === 'microsoft') setAuthStep(AUTH_STEP.MICROSOFT_ACCOUNT);
      else if (provider === 'local')  setAuthStep(AUTH_STEP.SIGNIN);
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleGoogleClick = () => {
    try { sessionStorage.setItem('expectedAuthEmail', email.trim().toLowerCase()); } catch {}
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet/10 border border-violet/20 text-3xl mb-4">
            🎙️
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">VoiceAssist</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Hands-free email &amp; messaging assistant</p>
        </div>

        <div className="card animate-slide-up" style={{ animationDelay: '60ms' }}>

          {authStep === AUTH_STEP.EMAIL && (
            <>
              <h2 className="text-lg font-semibold text-white mb-5">
                {intent === 'signin' ? 'Sign in to your account' : 'Create your account'}
              </h2>

              <button
                onClick={handleGoogleClick}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50
                           text-gray-800 font-medium text-sm py-2.5 px-4 rounded-xl
                           transition-colors active:scale-[0.98] mb-6"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {intent === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-dark-500" />
                <span className="text-gray-600 text-xs font-medium">OR</span>
                <div className="flex-1 h-px bg-dark-500" />
              </div>

              <form onSubmit={handleEmailContinue} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                    className="input-field"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-950/30 border border-danger/30 rounded-xl p-3">
                    <span className="text-danger text-base flex-shrink-0 mt-0.5">⚠️</span>
                    <p className="text-danger text-sm">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={checking} className="btn-primary w-full py-3 text-base mt-2">
                  {checking ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking…
                    </>
                  ) : 'Continue'}
                </button>
              </form>

              <div className="text-center mt-5 text-xs">
                {intent === 'signin' ? (
                  <button onClick={() => setIntent('signup')} className="text-violet-light hover:underline font-medium">
                    Don't have an account? Sign up
                  </button>
                ) : (
                  <button onClick={() => setIntent('signin')} className="text-violet-light hover:underline font-medium">
                    Already a user? Sign in
                  </button>
                )}
              </div>
            </>
          )}

          {authStep === AUTH_STEP.SIGNIN && (
            <form onSubmit={handleSigninSubmit} className="space-y-4">
              <div className="flex items-center justify-between bg-dark-700 rounded-xl px-3.5 py-2.5">
                <span className="text-gray-300 text-sm truncate">{email}</span>
                <button type="button" onClick={resetToEmailStep} className="text-violet-light text-xs hover:underline flex-shrink-0 ml-2">Change</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                <input type="password" value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  className="input-field" placeholder="••••••••" required autoComplete="current-password" autoFocus />
              </div>
              {error && (
                <div className="flex items-start gap-2.5 bg-red-950/30 border border-danger/30 rounded-xl p-3">
                  <span className="text-danger text-base flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
                {loading ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</>) : 'Sign In'}
              </button>

              <div className="text-center pt-1">
                <button type="button" onClick={goToSignupFresh} className="text-violet-light text-xs hover:underline font-medium">
                  Don't have an account? Sign up
                </button>
              </div>
            </form>
          )}

          {authStep === AUTH_STEP.SIGNUP && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="flex items-center justify-between bg-dark-700 rounded-xl px-3.5 py-2.5">
                <span className="text-gray-300 text-sm truncate">{email}</span>
                <button type="button" onClick={resetToEmailStep} className="text-violet-light text-xs hover:underline flex-shrink-0 ml-2">Change</button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name</label>
                <input type="text" value={name}
                  onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                  className="input-field" placeholder="Jane Smith" required autoComplete="name" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                <input type="password" value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                  className="input-field" placeholder="Min. 6 characters" required autoComplete="new-password" />
              </div>
              {error && (
                <div className="flex items-start gap-2.5 bg-red-950/30 border border-danger/30 rounded-xl p-3">
                  <span className="text-danger text-base flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
                {loading ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</>) : 'Create Account'}
              </button>
            </form>
          )}

          {authStep === AUTH_STEP.NOT_FOUND_SIGNIN && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-dark-700 rounded-xl px-3.5 py-2.5">
                <span className="text-gray-300 text-sm truncate">{email}</span>
                <button type="button" onClick={resetToEmailStep} className="text-violet-light text-xs hover:underline flex-shrink-0 ml-2">Change</button>
              </div>
              <div className="flex items-start gap-2.5 bg-dark-700 border border-dark-500 rounded-xl p-3.5">
                <span className="text-base flex-shrink-0">🤔</span>
                <p className="text-gray-300 text-sm">No account found with that email.</p>
              </div>
              <button onClick={() => setAuthStep(AUTH_STEP.SIGNUP)} className="btn-primary w-full py-3 text-base">
                Create one instead
              </button>
            </div>
          )}

          {authStep === AUTH_STEP.GOOGLE_ACCOUNT && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-dark-700 rounded-xl px-3.5 py-2.5">
                <span className="text-gray-300 text-sm truncate">{email}</span>
                <button type="button" onClick={resetToEmailStep} className="text-violet-light text-xs hover:underline flex-shrink-0 ml-2">Change</button>
              </div>
              <div className="flex items-start gap-2.5 bg-dark-700 border border-dark-500 rounded-xl p-3.5">
                <span className="text-base flex-shrink-0">🔐</span>
                <p className="text-gray-300 text-sm">This account uses Google Sign-In.</p>
              </div>
              <button onClick={handleGoogleClick}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50
                           text-gray-800 font-medium text-sm py-2.5 px-4 rounded-xl transition-colors active:scale-[0.98]">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          {authStep === AUTH_STEP.MICROSOFT_ACCOUNT && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-dark-700 rounded-xl px-3.5 py-2.5">
                <span className="text-gray-300 text-sm truncate">{email}</span>
                <button type="button" onClick={resetToEmailStep} className="text-violet-light text-xs hover:underline flex-shrink-0 ml-2">Change</button>
              </div>
              <div className="flex items-start gap-2.5 bg-dark-700 border border-dark-500 rounded-xl p-3.5">
                <span className="text-base flex-shrink-0">🔐</span>
                <p className="text-gray-300 text-sm">This account uses Microsoft Sign-In, which isn't enabled on this server yet.</p>
              </div>
            </div>
          )}

        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Your voice-powered productivity assistant 
        </p>
      </div>
    </div>
  );
}