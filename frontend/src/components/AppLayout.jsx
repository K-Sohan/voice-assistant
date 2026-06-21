import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import CDAssistant from './CDAssistant.jsx';
import api from '../services/api.js';

export default function AppLayout() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/profile')
      .then(({ data }) => { if (data.success) setProfile(data.profile); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-dark-950 lg:flex">
      {/* ── Persistent CD sidebar ──────────────────────────────────────── */}
      <aside className="lg:w-[400px] lg:flex-shrink-0 lg:h-screen lg:overflow-y-auto
                         border-b lg:border-b-0 lg:border-r border-dark-600 p-4">
       <CDAssistant
          preferredLanguage={profile?.preferredLanguage || 'en-US'}
          voicePinSet={profile?.voicePinSet || false}
          voiceSpeed={profile?.voiceSpeed || 1.0}
        />
      </aside>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="flex-1 lg:h-screen lg:overflow-y-auto">
        <Outlet context={{ profile, setProfile }} />
      </main>
    </div>
  );
}