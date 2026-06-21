import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext.jsx';
import Navbar          from '../components/Navbar.jsx';
import api             from '../services/api.js';
import gmailApi        from '../services/gmailApi.js';

export default function Dashboard() {
  const { user }     = useAuth();
  const [profile,    setProfile]  = useState(null);
  const [greeting,   setGreeting] = useState('Hello');
  const [emails,        setEmails]        = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    api.get('/profile')
      .then(({ data }) => { if (data.success) setProfile(data.profile); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    gmailApi.getStatus()
      .then((data) => {
        setGmailConnected(data.connected);
        if (data.connected) {
          gmailApi.getInbox(7).then(({ emails = [] }) => setEmails(emails)).catch(() => {});
          gmailApi.getUnreadCount().then(({ count }) => setUnreadCount(count)).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 max-w-2xl">

            <div className="mb-2 animate-slide-up">
              <h1 className="text-3xl font-bold text-white">
                {greeting}, <span className="text-violet-light">{firstName}</span>
                <span className="ml-2">👋</span>
              </h1>
              <p className="text-gray-500 mt-1.5">
                Say <span className="font-mono text-violet-light text-sm">CD</span> to
                wake your assistant. Gmail email commands are now available.
              </p>
            </div>

          {/* ── Voice commands — collapsible handbook ──────────────────────── */}
          <details className="card animate-slide-up group" style={{ animationDelay: '120ms' }}>
            <summary className="cursor-pointer font-medium text-gray-300 text-sm flex items-center justify-between select-none">
              <span className="flex items-center gap-2">🗣️ Voice Command Handbook</span>
              <span className="text-gray-600 text-xs group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="space-y-1.5 mt-3">
              {[
                'CD → wake word',
                '"Read my inbox"',
                '"Read latest email"',
                '"Read email 1-5"',
                '"Summarize email 1-5"',
                '"Reply to email 1-5"',
                '"Suggest a reply"',
                '"Any unread emails"',
                '"Mark email 1 as read"',
                '"Delete email 1"',
                '"Find emails from …"',
                '"Compose an email"',
                '"Open profile"',
                '"Stop" → interrupt CD',
                '"Goodbye" → sleep',
              ].map((cmd) => (
                <p key={cmd} className="text-xs font-mono text-gray-500 bg-dark-700 px-2.5 py-1.5 rounded-lg">
                  {cmd}
                </p>
              ))}
            </div>
          </details>

          {/* ── Voice Security ───────────────────────────────────────────── */}
          <div className="card animate-slide-up flex items-center justify-between py-3" style={{ animationDelay: '160ms' }}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${profile?.voicePinSet ? 'bg-success' : 'bg-dark-400'}`} />
              <span className="text-sm text-gray-400">
                Voice PIN:{' '}
                {profile?.voicePinSet
                  ? <span className="text-success font-medium">Configured</span>
                  : <span className="text-gray-600">Not set</span>}
              </span>
            </div>
            <Link to="/settings" className="text-xs text-violet-light hover:text-violet transition-colors">
                {profile?.voicePinSet ? 'Update PIN →' : 'Set up Voice PIN →'}
              </Link>
          </div>

        </div>

          {/* ── Right column: stats + inbox preview ─────────────────────── */}
          <div className="space-y-4">

            <div className="card animate-slide-up" style={{ animationDelay: '80ms' }}>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span>📊</span> Quick Stats
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Gmail</span>
                  <span className={`text-xs font-semibold ${gmailConnected ? 'text-success' : 'text-gray-600'}`}>
                    {gmailConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Unread emails</span>
                  <span className="text-xs font-semibold text-violet-light">
                    {unreadCount === null ? '—' : unreadCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="card animate-slide-up" style={{ animationDelay: '120ms' }}>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span>📬</span> Inbox Preview
              </h3>
              {!gmailConnected ? (
                <p className="text-gray-600 text-sm">Connect Gmail to see your inbox.</p>
              ) : emails.length === 0 ? (
                <p className="text-gray-600 text-sm">No emails found.</p>
              ) : (
                <div className="space-y-2">
                  {emails.map((e, i) => {
                    const from    = e.from.replace(/<[^>]+>/g, '').replace(/"/g, '').trim();
                    const subject = e.subject.replace(/[^\x00-\x7F]/g, '').trim();
                    return (
                      <div key={e.id} className="flex items-start gap-2 bg-dark-700 rounded-lg px-2.5 py-2">
                        <span className="text-xs text-gray-600 font-mono mt-0.5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-300 font-medium truncate">{from}</p>
                          <p className="text-xs text-gray-500 truncate">{subject}</p>
                        </div>
                        {e.isUnread && <span className="w-1.5 h-1.5 rounded-full bg-violet flex-shrink-0 mt-1" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}