import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api    from '../services/api.js';

const LANGUAGES = [
  { code: 'en-US', label: '🇺🇸  English (US)' },
  { code: 'en-GB', label: '🇬🇧  English (UK)' },
  { code: 'en-IN', label: '🇮🇳  English (India)' },
];

const Alert = ({ type, text, onClose }) => (
  <div
    className={`flex items-start gap-2.5 rounded-xl p-3.5 border ${
      type === 'success'
        ? 'bg-green-950/30 border-success/30 text-success'
        : 'bg-red-950/30 border-danger/30 text-danger'
    } animate-fade-in`}
  >
    <span>{type === 'success' ? '✅' : '⚠️'}</span>
    <p className="text-sm flex-1">{text}</p>
    {onClose && (
      <button onClick={onClose} className="text-base opacity-60 hover:opacity-100 transition-opacity">×</button>
    )}
  </div>
);

export default function Settings() {
  const { setProfile } = useOutletContext();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [savingPin,   setSavingPin]   = useState(false);
  const [msg,         setMsg]         = useState(null);
  const [pinMsg,      setPinMsg]      = useState(null);
  const [pinSet,      setPinSet]      = useState(false);

  const [prefs, setPrefs] = useState({ preferredLanguage: 'en-US', voiceSpeed: 1.0 });
  const [pin, setPin] = useState({ newPin: '', confirmPin: '' });

  useEffect(() => {
    api.get('/profile')
      .then(({ data }) => {
        if (data.success) {
          const p = data.profile;
          setPrefs({
            preferredLanguage: p.preferredLanguage || 'en-US',
            voiceSpeed:        p.voiceSpeed ?? 1.0,
          });
          setPinSet(p.voicePinSet || false);
        }
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load settings. Please refresh.' }))
      .finally(() => setPageLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const { data } = await api.put('/profile', prefs);
      if (data.success) {
        setProfile((p) => ({ ...p, ...prefs }));
        setMsg({ type: 'success', text: 'Voice preferences saved!' });
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save preferences.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async () => {
    setPinMsg(null);
    if (!pin.newPin || !/^\d{4,6}$/.test(pin.newPin)) {
      setPinMsg({ type: 'error', text: 'PIN must be 4-6 numeric digits.' });
      return;
    }
    if (pin.newPin !== pin.confirmPin) {
      setPinMsg({ type: 'error', text: 'PINs do not match. Please re-enter.' });
      return;
    }
    setSavingPin(true);
    try {
      const { data } = await api.post('/profile/set-pin', { pin: pin.newPin });
      if (data.success) {
        setPinSet(true);
        setPin({ newPin: '', confirmPin: '' });
        setPinMsg({ type: 'success', text: 'Voice PIN saved! Your assistant is now PIN-protected.' });
        setTimeout(() => setPinMsg(null), 4000);
      }
    } catch (err) {
      setPinMsg({ type: 'error', text: err.response?.data?.message || 'Failed to set PIN.' });
    } finally {
      setSavingPin(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-dark-500" />
            <div className="absolute inset-0 rounded-full border-4 border-t-violet border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">

        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-500 mt-1.5">Configure your voice assistant.</p>
        </div>

        {/* ── Voice preferences ─────────────────────────────────────────── */}
        <div className="card mb-6 animate-slide-up">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <span>🎙️</span> Voice Preferences
          </h2>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Recognition Language</label>
            <select
              value={prefs.preferredLanguage}
              onChange={(e) => setPrefs((p) => ({ ...p, preferredLanguage: e.target.value }))}
              className="input-field"
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-600 mt-1.5">
              Affects how CD recognizes your accent for commands.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Voice Speed:{' '}
              <span className="font-mono text-violet-light">{Number(prefs.voiceSpeed).toFixed(1)}×</span>
            </label>
            <input
              type="range"
              min="0.5" max="2.0" step="0.1"
              value={prefs.voiceSpeed}
              onChange={(e) => setPrefs((p) => ({ ...p, voiceSpeed: parseFloat(e.target.value) }))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                         bg-dark-500 [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet
                         [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1.5">
              <span>0.5× Slow</span>
              <span>1.0× Normal</span>
              <span>2.0× Fast</span>
            </div>
          </div>
        </div>

        <div className="mb-6 animate-slide-up" style={{ animationDelay: '60ms' }}>
          {msg && <div className="mb-4"><Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} /></div>}
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 text-base">
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : '💾 Save Voice Preferences'}
          </button>
        </div>

        {/* ── Voice PIN ─────────────────────────────────────────────────── */}
        <div className="card animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-semibold text-white mb-1.5 flex items-center gap-2">
            <span>🔐</span> Voice PIN
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            {pinSet
              ? 'Your assistant is PIN-protected. Set a new PIN below to update it.'
              : 'Set a 4-6 digit PIN to secure voice-activated commands.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin.newPin}
                onChange={(e) => setPin((p) => ({ ...p, newPin: e.target.value.replace(/\D/g, '') }))}
                className="input-field"
                placeholder="••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin.confirmPin}
                onChange={(e) => setPin((p) => ({ ...p, confirmPin: e.target.value.replace(/\D/g, '') }))}
                className="input-field"
                placeholder="••••"
              />
            </div>
          </div>

          {pinMsg && <div className="mb-4"><Alert type={pinMsg.type} text={pinMsg.text} onClose={() => setPinMsg(null)} /></div>}

          <button onClick={handleSavePin} disabled={savingPin} className="btn-primary w-full py-3 text-base">
            {savingPin ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (pinSet ? '🔐 Update Voice PIN' : '🔐 Set Voice PIN')}
          </button>
        </div>

      </main>
    </div>
  );
}