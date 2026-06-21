import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Navbar from '../components/Navbar.jsx';
import api      from '../services/api.js';
import gmailApi from '../services/gmailApi.js';

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
  const { user, loadUser, logout } = useAuth();
  const navigate = useNavigate();

  const [pageLoading, setPageLoading] = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState(null);
  const [name,        setName]        = useState('');

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail,     setGmailEmail]     = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    Promise.all([
      api.get('/profile'),
      gmailApi.getStatus().catch(() => ({ connected: false, email: '' })),
    ])
      .then(([profileRes, gmailStatus]) => {
        setGmailConnected(gmailStatus.connected || false);
        setGmailEmail(gmailStatus.email || '');
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load profile. Please refresh.' }))
      .finally(() => setPageLoading(false));
  }, [user]);

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const { data } = await api.put('/profile', { name });
      if (data.success) {
        setMsg({ type: 'success', text: 'Profile saved successfully!' });
        await loadUser();
        setTimeout(() => setMsg(null), 4000);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true); setDeleteError('');
    try {
      await api.delete('/auth/account');
      await logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

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
          <h1 className="text-3xl font-bold text-white">Profile</h1>
          <p className="text-gray-500 mt-1.5">Your account identity and activity.</p>
        </div>

        {/* ── Identity card ───────────────────────────────────────────────── */}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Your display name"
            />
          </div>
        </div>

        <div className="mb-6 animate-slide-up" style={{ animationDelay: '40ms' }}>
          {msg && <div className="mb-4"><Alert type={msg.type} text={msg.text} onClose={() => setMsg(null)} /></div>}
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 text-base">
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : '💾 Save Profile'}
          </button>
        </div>

        {/* ── Account activity ───────────────────────────────────────────── */}
        <div className="card mb-6 animate-slide-up" style={{ animationDelay: '80ms' }}>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📅</span> Account Activity
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Member since</span>
            <span className="text-sm text-white font-medium">{memberSince}</span>
          </div>
        </div>

        {/* ── Connected accounts ─────────────────────────────────────────── */}
        <div className="card mb-6 animate-slide-up" style={{ animationDelay: '120ms' }}>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>🔗</span> Connected Accounts
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📧</span>
              <div>
                <p className="text-sm font-medium text-white">Gmail</p>
                {gmailConnected && <p className="text-xs text-gray-500">{gmailEmail}</p>}
              </div>
            </div>
            <span className={`text-xs font-semibold ${gmailConnected ? 'text-success' : 'text-gray-600'}`}>
              {gmailConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </div>

        {/* ── Danger zone ─────────────────────────────────────────────────── */}
        <div className="card border-danger/20 animate-slide-up" style={{ animationDelay: '160ms' }}>
          <h2 className="text-lg font-semibold text-danger mb-4 flex items-center gap-2">
            <span>⚠️</span> Danger Zone
          </h2>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 rounded-xl border border-danger/30 text-danger text-sm font-medium
                         hover:bg-red-950/30 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                This will permanently delete your account, Gmail connection, and all preferences. This cannot be undone.
              </p>
              {deleteError && <Alert type="error" text={deleteError} onClose={() => setDeleteError('')} />}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-dark-400 text-gray-300 text-sm font-medium
                             hover:bg-dark-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-medium
                             hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}