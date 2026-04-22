import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// ── Voice login steps ─────────────────────────────────────────────────────────
const VSTEP = {
  IDLE: 'idle',
  EMAIL: 'email',
  CONFIRM: 'confirm',
  PIN: 'pin',
  VERIFYING: 'verifying',
  DONE: 'done',
};

const VSTEP_LABEL = {
  idle: 'Press the mic to sign in by voice',
  email: 'Listening for your email…',
  confirm: 'Confirming email…',
  pin: 'Listening for your PIN…',
  verifying: 'Verifying…',
  done: 'Signing in…',
};

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Regular form state ────────────────────────────────────────────────────
  const [tab, setTab] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Voice login state ─────────────────────────────────────────────────────
  const [vStep, setVStep] = useState(VSTEP.IDLE);
  const [vStatus, setVStatus] = useState('');
  const [vError, setVError] = useState('');
  const vStepRef = useRef(VSTEP.IDLE);
  const recognitionRef = useRef(null);

  // ── Redirect if already logged in ────────────────────────────────────────
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopRecognition();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateVStep = (s) => { vStepRef.current = s; setVStep(s); };

  const speak = (text) =>
    new Promise((resolve) => {
      if (!window.speechSynthesis) { resolve(); return; }
      window.speechSynthesis.cancel();

      // Wait for cancel to fully clear
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang   = 'en-US';
        u.rate   = 1.0;
        u.pitch  = 1.05;
        u.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const voice  =
          voices.find((v) => v.name.includes('Google') && v.lang === 'en-US') ||
          voices.find((v) => v.lang === 'en-US' && !v.localService)           ||
          voices.find((v) => v.lang.startsWith('en'));
        if (voice) u.voice = voice;

        setCdResponse(text); // only in CDAssistant, remove for Login

        // Estimate duration: ~80ms per word + 600ms buffer
        const wordCount      = text.trim().split(/\s+/).length;
        const estimatedMs    = wordCount * 80 + 600;
        let resolved         = false;

        const done = () => {
          if (!resolved) {
            resolved = true;
            // Extra buffer after speech ends before mic opens
            setTimeout(resolve, 1500);
          }
        };

        u.onend   = done;
        u.onerror = done;

        // Fallback: resolve after estimated duration regardless
        setTimeout(done, estimatedMs + 1000);

        window.speechSynthesis.speak(u);
      }, 500);
    });
  const stopRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  };

  const listenOnce = (timeoutMs = 12000, type = 'command') =>
    new Promise((resolve, reject) => {
      if (!SpeechRecognitionAPI) { reject(new Error('not-supported')); return; }
      stopRecognition();

      const r = new SpeechRecognitionAPI();
      r.lang            = 'en-IN';
      r.continuous      = type === 'pin';
      r.interimResults  = false;
      r.maxAlternatives = 5;
      recognitionRef.current = r;

      let done = false;
      const finish = (fn) => {
        if (!done) { done = true; clearTimeout(timer); clearTimeout(pinTimer); fn(); }
      };

      const timer = setTimeout(
        () => finish(() => {
          try { r.abort(); } catch { /* ignore */ }
          reject(new Error('timeout'));
        }),
        timeoutMs
      );

      let pinTimer = null;
      let pinTranscript = '';

      r.onresult = (e) => {
        if (type === 'pin') {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              pinTranscript += ' ' + e.results[i][0].transcript;
            }
          }
          clearTimeout(pinTimer);
          pinTimer = setTimeout(() => {
            finish(() => {
              try { r.abort(); } catch { /* ignore */ }
              resolve([pinTranscript.trim()]);
            });
          }, 2000);
        } else {
          const alternatives = Array.from(e.results[0]).map((a) => a.transcript);
          finish(() => resolve(alternatives));
        }
      };

      r.onerror  = (e) => finish(() => reject(new Error(e.error)));

      r.onend = () => {
        if (type === 'pin' && pinTranscript) {
          finish(() => resolve([pinTranscript.trim()]));
        } else {
          finish(() => reject(new Error('ended')));
        }
      };

      setTimeout(() => {
        try { r.start(); } catch (e) { finish(() => reject(e)); }
      }, 500);
    });

  // ── Parse spoken PIN ──────────────────────────────────────────────────────
  const parseSpokenPin = (text) => {
    const map = {
      zero: '0', one: '1', two: '2', three: '3', four: '4',
      five: '5', six: '6', seven: '7', eight: '8', nine: '9',
      oh: '0', to: '2', too: '2', for: '4', ate: '8',
    };
    return text.toLowerCase().split(/[\s,.\-]+/)
      .map((w) => map[w] !== undefined ? map[w] : w)
      .join('').replace(/\D/g, '');
  };

  // ── Helpers for voice login ───────────────────────────────────────────────────
  /*const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normaliseEmail = (text) =>
    text
      .toLowerCase()
      .replace(/\bat\b/gi, '@')
      .replace(/\bdot\b/gi, '.')
      .replace(/\s+at\s+/gi, '@')
      .replace(/\s+dot\s+/gi, '.')
      .replace(/\s/g, '')
      .replace(/[^a-z0-9@._+\-]/g, '');*/

  // ── Main voice login flow ─────────────────────────────────────────────────────
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const startVoiceLogin = async () => {
    if (!SpeechRecognitionAPI) {
      setVError('Voice login requires Google Chrome or Microsoft Edge.');
      return;
    }
    setVError(''); setVStatus('');

    // ── Step 1: Email ────────────────────────────────────────────────────────
    // ── Step 1a: Username ──────────────────────────────────────────────────────
    updateVStep(VSTEP.EMAIL);
    await speak("Please say your username — the part before the at symbol.");
    await delay(700);

    let username = '';
    try {
      setVStatus('Listening for username…');
      const alts = await listenOnce(15000);
      username = (alts[0] || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9._+\-]/g, '');
    } catch {
      await speak("I didn't catch that. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    if (!username) {
      await speak("I didn't get a username. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    // ── Step 1b: Domain ────────────────────────────────────────────────────────
    await speak(`Got it — ${username}. Now say your domain. For example: gmail dot com.`);
    await delay(700);

    let domain = '';
    try {
      setVStatus('Listening for domain…');
      const alts = await listenOnce(15000);
      const raw  = (alts[0] || '').toLowerCase().trim();
      domain = raw
        .replace(/\s+dot\s+/g, '.')
        .replace(/\bdot\b/g, '.')
        .replace(/\s+period\s+/g, '.')
        .replace(/\s*\.\s*/g, '.')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9.\-]/g, '');
    } catch {
      await speak("I didn't catch the domain. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    if (!domain || !domain.includes('.')) {
      await speak("That doesn't look like a valid domain. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    // ── Step 1c: Confirm ───────────────────────────────────────────────────────
    const normalisedEmail = `${username}@${domain}`;
    const spokenEmail     = `${username} at ${domain.replace(/\./g, ' dot ')}`;

    updateVStep(VSTEP.CONFIRM);
    await speak(`Your email is ${spokenEmail}. Is that correct? Say yes or no.`);
    await delay(500);

    try {
      const alts   = await listenOnce(8000);
      const answer = (alts[0] || '').toLowerCase();
      if (!/yes|yeah|yep|correct|right|sure|confirm|absolutely/.test(answer)) {
        await speak("Let's try again.");
        updateVStep(VSTEP.IDLE); setVStatus(''); return;
      }
    } catch {
      await speak("I didn't hear a response. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    // ── Step 2: PIN (unchanged — keep exactly as you have it) ─────────────────

    // ── Step 3: PIN ──────────────────────────────────────────────────────────
    updateVStep(VSTEP.PIN);
    await speak("Now please say your Voice PIN.");
    await delay(700);

    let pin = '';
    try {
      setVStatus('Listening for PIN…');
      const alternatives = await listenOnce(15000, 'pin');

      for (const alt of alternatives) {
        const { data } = await api.post('/voice/parse-pin', { speech: alt });
        if (data.success && data.pin) { pin = data.pin; break; }
      }
    } catch {
      await speak("I didn't catch your PIN. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    if (!pin || pin.length < 4) {
      await speak("I couldn't understand the PIN. Please try again.");
      updateVStep(VSTEP.IDLE); setVStatus(''); return;
    }

    // ── Step 4: Verify ───────────────────────────────────────────────────────
    updateVStep(VSTEP.VERIFYING);
    setVStatus('Verifying…');
    try {
      const { data } = await api.post('/auth/voice-login', {
        email: normalisedEmail,
        pin,
      });
      if (data.success) {
        updateVStep(VSTEP.DONE);
        await speak(`Welcome back, ${data.user.name.split(' ')[0]}! Signing you in.`);
        login(data.token, data.user);
        navigate('/dashboard');
      } else {
        await speak(data.message || "Login failed. Please try again.");
        updateVStep(VSTEP.IDLE); setVStatus('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed. Please try again.";
      await speak(msg);
      setVError(msg);
      updateVStep(VSTEP.IDLE); setVStatus('');
    }
  };
  const cancelVoiceLogin = () => {
    stopRecognition();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    updateVStep(VSTEP.IDLE);
    setVStatus('');
    setVError('');
  };

  // ── Regular form handlers ──────────────────────────────────────────────────
  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const switchTab = (t) => { setTab(t); setError(''); setSuccess(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const isSignin = tab === 'signin';
      const endpoint = isSignin ? '/auth/login' : '/auth/register';
      const payload = isSignin
        ? { email: form.email, password: form.password }
        : { name: form.name.trim(), email: form.email, password: form.password };
      const { data } = await api.post(endpoint, payload);
      if (data.success) {
        if (!isSignin) {
          setSuccess('Account created! Redirecting…');
          setTimeout(() => { login(data.token, data.user); navigate('/dashboard'); }, 900);
        } else {
          login(data.token, data.user);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isVoiceActive = vStep !== VSTEP.IDLE;

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet/10 border border-violet/20 text-3xl mb-4">
            🎙️
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">VoiceAssist</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Hands-free email &amp; messaging assistant</p>
        </div>

        {/* ── Voice Login Card ─────────────────────────────────────────────── */}
        <div className="card mb-4 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                🔐 Voice Sign In
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Sign in using your email + Voice PIN
              </p>
            </div>
            {/* Status indicator */}
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isVoiceActive ? 'bg-red-400 animate-pulse' : 'bg-dark-400'
              }`} />
          </div>

          {/* Orb */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              {isVoiceActive && (
                <>
                  <span className="absolute inset-0 rounded-full bg-violet opacity-10 animate-ping scale-125" />
                  <span className="absolute inset-0 rounded-full bg-violet opacity-10 animate-pulse scale-150" />
                </>
              )}
              <button
                onClick={isVoiceActive ? cancelVoiceLogin : startVoiceLogin}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center
                            text-2xl transition-all duration-300 shadow-xl
                            ${isVoiceActive
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30 scale-110'
                    : 'bg-violet hover:bg-violet-hover shadow-violet/30 hover:scale-105'
                  }`}
              >
                {isVoiceActive ? '⏹' : '🎙️'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              {VSTEP_LABEL[vStep]}
            </p>

            {vStatus && isVoiceActive && (
              <div className="w-full bg-violet-dim border border-violet/20 rounded-xl px-3 py-2">
                <p className="text-violet-light text-xs text-center">{vStatus}</p>
              </div>
            )}

            {vError && (
              <div className="w-full bg-red-950/30 border border-danger/30 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-danger text-xs flex-1">{vError}</span>
                <button onClick={() => setVError('')} className="text-gray-600 hover:text-gray-300">×</button>
              </div>
            )}

            {!SpeechRecognitionAPI && (
              <p className="text-xs text-warn text-center">
                ⚠️ Voice login requires Chrome or Edge
              </p>
            )}
          </div>
        </div>

        {/* ── Main Auth Card ───────────────────────────────────────────────── */}
        <div className="card animate-slide-up" style={{ animationDelay: '60ms' }}>
          {/* Tab switcher */}
          <div className="flex bg-dark-700 rounded-xl p-1 mb-6">
            {[
              { id: 'signin', label: 'Sign In' },
              { id: 'signup', label: 'Create Account' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === id
                    ? 'bg-violet text-white shadow-lg shadow-violet/20'
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => { window.location.href = '/api/auth/google'; }}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50
                         text-gray-800 font-medium text-sm py-2.5 px-4 rounded-xl
                         transition-colors active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => { window.location.href = '/api/auth/microsoft'; }}
              className="w-full flex items-center justify-center gap-3 bg-dark-600 hover:bg-dark-500
                         text-gray-300 hover:text-white font-medium text-sm py-2.5 px-4 rounded-xl
                         border border-dark-400 transition-colors active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Continue with Microsoft
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-dark-500" />
            <span className="text-gray-600 text-xs font-medium">OR</span>
            <div className="flex-1 h-px bg-dark-500" />
          </div>

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  className="input-field" placeholder="Jane Smith" required autoComplete="name" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                className="input-field" placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <input type="password" name="password" value={form.password} onChange={handleChange}
                className="input-field"
                placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                required
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-950/30 border border-danger/30 rounded-xl p-3">
                <span className="text-danger text-base flex-shrink-0 mt-0.5">⚠️</span>
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2.5 bg-green-950/30 border border-success/30 rounded-xl p-3">
                <span className="text-success">✅</span>
                <p className="text-success text-sm">{success}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {tab === 'signin' ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                tab === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">
          Your voice-powered productivity assistant · Part 2 of 4
        </p>
      </div>
    </div>
  );
}