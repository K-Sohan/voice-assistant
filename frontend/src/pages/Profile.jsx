import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import api    from '../services/api.js';

const LANGUAGES = [
  { code: 'en-US', label: '🇺🇸  English (US)' },
  { code: 'en-GB', label: '🇬🇧  English (UK)' },
  { code: 'es-ES', label: '🇪🇸  Spanish (Spain)' },
  { code: 'fr-FR', label: '🇫🇷  French' },
  { code: 'de-DE', label: '🇩🇪  German' },
  { code: 'hi-IN', label: '🇮🇳  Hindi' },
  { code: 'zh-CN', label: '🇨🇳  Chinese (Simplified)' },
  { code: 'ja-JP', label: '🇯🇵  Japanese' },
  { code: 'pt-BR', label: '🇧🇷  Portuguese (Brazil)' },
  { code: 'ar-SA', label: '🇸🇦  Arabic' },
];

const PLATFORMS = [
  { key: 'gmail',    label: 'Gmail',           icon: '📧' },
  { key: 'outlook',  label: 'Outlook',         icon: '📮' },
  { key: 'slack',    label: 'Slack',           icon: '💬' },
  { key: 'whatsapp', label: 'WhatsApp',        icon: '📱' },
  { key: 'teams',    label: 'Microsoft Teams', icon: '🔷' },
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

export default function Profile() {
  const { user, loadUser } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [savingPin,   setSavingPin]   = useState(false);
  const [msg,         setMsg]         = useState(null); // { type, text }
  const [pinMsg,      setPinMsg]      = useState(null);
  const [pinSet,      setPinSet]      = useState(false);

  const [prefs, setPrefs] = useState({
    name:               '',
    preferredLanguage:  'en-US',
    voiceSpeed:         1.0,
    messagingPlatforms: { gmail: false, outlook: false, slack: false, whatsapp: false, teams: false },
  });

  const [pin, setPin] = useState({ newPin: '', confirmPin: '' });

  // ── Load profile on mount ─────────────────────────────────────────────────
  useEffect(() => {
    api.get('/profile')
      .then(({ data }) => {
        if (data.success) {
          const p = data.profile;
          setPrefs({
            name:               user?.name || '',
            preferredLanguage:  p.preferredLanguage || 'en-US',
            voiceSpeed:         p.voiceSpeed ?? 1.0,
            messagingPlatforms: p.messagingPlatforms || {
              gmail: false, outlook: false, slack: false, whatsapp: false, teams: false,
            },
          });
          setPinSet(p.voicePinSet || false);
        }
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load profile. Please refresh.' }))
      .finally(() => setPageLoading(false));
  }, [user]);

  const handlePlatformToggle = (key) => {
    setPrefs((p) => ({
      ...p,
      messagingPlatforms: { ...p.messagingPlatforms, [key]: !p.messagingPlatforms[key] },
    }));
  };

  // ── Save profile ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await api.put('/profile', prefs);
      if (data.success) {
        setMsg({ type: 'success', text: 'Profile saved successfully!' });
        await loadUser(); // Refresh navbar name
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save Voice PIN ─────────────────────────────────────────────────────────
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
        {/* Header */}
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white">Profile Settings</h1>
          <p className="text-gray-500 mt-1.5">Manage your preferences and voice assistant configuration.</p>
        </div>

        {/* ── Identity card ────────────────────────────────────────────────── */}
        <div className="card mb-6 animate-slide-up">
          <div className="flex items-center gap-4 mb-6">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name}
                className="w-16 h-16 rounded-2xl ring-2 ring-dark-400 object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-violet/20 border border-violet/30
                              flex items-center justify-center text-violet text-2xl font-bold">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-white">{user?.name}</p>
              <p className="text-gray-500 text-sm">{user?.email}</p>
              <span className="badge bg-dark-600 text-gray-400 border border-dark-400 mt-1 capitalize">
                {user?.authProvider || 'local'} account
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={prefs.name}
              onChange={(e) => setPrefs((p) => ({ ...p, name: e.target.value }))}
              className="input-field"
              placeholder="Your display name"
            />
          </div>
        </div>

        {/* ── Voice preferences ─────────────────────────────────────────────── */}
        <div className="card mb-6 animate-slide-up" style={{ animationDelay: '60ms' }}>
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <span>🎙️</span> Voice Preferences
          </h2>

          {/* Language */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Recognition Language
            </label>
            <select
              value={prefs.preferredLanguage}
              onChange={(e) => setPrefs((p) => ({ ...p, preferredLanguage: e.target.value }))}
              className="input-field"
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>

          {/* Voice speed */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Voice Speed:{' '}
              <span className="font-mono text-violet-light">
                {Number(prefs.voiceSpeed).toFixed(1)}×
              </span>
            </label>
            <input
              type="range"
              min="0.5" max="2.0" step="0.1"
              value={prefs.voiceSpeed}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, voiceSpeed: parseFloat(e.target.value) }))
              }
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

        {/* ── Messaging platforms ────────────────────────────────────────────── */}
        <div className="card mb-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h2 className="text-lg font-semibold text-white mb-1.5 flex items-center gap-2">
            <span>📡</span> Messaging Platforms
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            Select platforms you'll integrate (connections available in Parts 2 &amp; 3).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PLATFORMS.map(({ key, label, icon }) => {
              const active = prefs.messagingPlatforms?.[key] ?? false;
              return (
                <button
                  key={key}
                  onClick={() => handlePlatformToggle(key)}
                  className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-left
                              transition-all duration-150 active:scale-[0.97] ${
                    active
                      ? 'border-violet/40 bg-violet-dim text-white'
                      : 'border-dark-500 bg-dark-700 text-gray-500 hover:border-dark-400 hover:text-gray-300'
                  }`}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="text-sm font-medium flex-1">{label}</span>
                  {active && <span className="text-violet text-xs font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Save button ───────────────────────────────────────────────────── */}
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '140ms' }}>
          {msg && <div className="mb-4"><Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} /></div>}
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 text-base">
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : '💾 Save Profile Settings'}
          </button>
        </div>

        {/* ── Voice PIN ─────────────────────────────────────────────────────── */}
        <div className="card animate-slide-up" style={{ animationDelay: '180ms' }}>
          <h2 className="text-lg font-semibold text-white mb-1.5 flex items-center gap-2">
            <span>🔐</span> Voice PIN Authentication
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            A 4-6 digit numeric PIN that will be required before the voice assistant activates.
            {pinSet && (
              <span className="ml-1 text-success font-medium">Your PIN is currently set.</span>
            )}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                {pinSet ? 'New PIN' : 'Set PIN'} (4-6 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin.newPin}
                onChange={(e) =>
                  setPin((p) => ({ ...p, newPin: e.target.value.replace(/\D/g, '') }))
                }
                className="input-field font-mono tracking-[0.5em] text-center text-lg"
                placeholder="• • • • • •"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin.confirmPin}
                onChange={(e) =>
                  setPin((p) => ({ ...p, confirmPin: e.target.value.replace(/\D/g, '') }))
                }
                className="input-field font-mono tracking-[0.5em] text-center text-lg"
                placeholder="• • • • • •"
              />
            </div>

            {/* PIN match indicator */}
            {pin.newPin && pin.confirmPin && (
              <p className={`text-xs ${pin.newPin === pin.confirmPin ? 'text-success' : 'text-danger'}`}>
                {pin.newPin === pin.confirmPin ? '✓ PINs match' : '✗ PINs do not match'}
              </p>
            )}

            {pinMsg && (
              <Alert type={pinMsg.type} text={pinMsg.text} onClose={() => setPinMsg(null)} />
            )}

            <button onClick={handleSavePin} disabled={savingPin} className="btn-secondary w-full py-2.5">
              {savingPin ? (
                <>
                  <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                  Setting PIN…
                </>
              ) : pinSet ? '🔄 Update Voice PIN' : '🔐 Set Voice PIN'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}