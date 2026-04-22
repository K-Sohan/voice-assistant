import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext.jsx';
import Navbar          from '../components/Navbar.jsx';
import CDAssistant     from '../components/CDAssistant.jsx';   // ← changed
import api             from '../services/api.js';

const STATUS_ITEMS = [
  { label: 'Voice Engine',      status: 'Online',  color: 'text-success',  dot: 'bg-success'  },
  { label: 'Speech-to-Text',    status: 'Ready',   color: 'text-success',  dot: 'bg-success'  },
  { label: 'Wake Word (CD)',     status: 'Online',  color: 'text-success',  dot: 'bg-success'  },
  { label: 'Gmail',             status: 'Ready',   color: 'text-success',  dot: 'bg-success'  },
  { label: 'Messaging (Slack)', status: 'Part 3',  color: 'text-warn',     dot: 'bg-warn'     },
  { label: 'AI Compose',        status: 'Part 4',  color: 'text-gray-600', dot: 'bg-dark-500' },
];

export default function Dashboard() {
  const { user }     = useAuth();
  const [profile,    setProfile]  = useState(null);
  const [greeting,   setGreeting] = useState('Hello');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    api.get('/profile')
      .then(({ data }) => { if (data.success) setProfile(data.profile); })
      .catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-dark-950">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold text-white">
            {greeting}, <span className="text-violet-light">{firstName}</span>
            <span className="ml-2">👋</span>
          </h1>
          <p className="text-gray-500 mt-1.5">
            Say <span className="font-mono text-violet-light text-sm">CD</span> to
            wake your assistant. Gmail email commands are now available.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── CDAssistant (2 cols) ─────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <CDAssistant
              preferredLanguage={profile?.preferredLanguage || 'en-US'}
              voicePinSet={profile?.voicePinSet || false}
            />
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-5">

            <div className="card animate-slide-up" style={{ animationDelay: '80ms' }}>
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span>📡</span> System Status
              </h3>
              <div className="space-y-3">
                {STATUS_ITEMS.map(({ label, status, color, dot }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      <span className="text-gray-400 text-sm">{label}</span>
                    </div>
                    <span className={`text-xs font-semibold ${color}`}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card animate-slide-up" style={{ animationDelay: '120ms' }}>
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span>🗣️</span> Voice Commands
              </h3>
              <div className="space-y-1.5">
                {[
                  'CD → wake word',
                  '"Read my inbox"',
                  '"Read latest email"',
                  '"Any unread emails"',
                  '"Compose email to …"',
                  '"Open profile"',
                  '"Status"',
                  '"Goodbye" → sleep',
                ].map((cmd) => (
                  <p key={cmd} className="text-xs font-mono text-gray-500 bg-dark-700 px-2.5 py-1.5 rounded-lg">
                    {cmd}
                  </p>
                ))}
              </div>
            </div>

            <div className="card animate-slide-up" style={{ animationDelay: '160ms' }}>
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <span>🔐</span> Voice Security
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${profile?.voicePinSet ? 'bg-success' : 'bg-dark-400'}`} />
                <span className="text-sm text-gray-400">
                  PIN:{' '}
                  {profile?.voicePinSet
                    ? <span className="text-success font-medium">Configured</span>
                    : <span className="text-gray-600">Not set</span>}
                </span>
              </div>
              <Link to="/profile" className="text-xs text-violet-light hover:text-violet transition-colors">
                {profile?.voicePinSet ? 'Update PIN →' : 'Set up Voice PIN →'}
              </Link>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}