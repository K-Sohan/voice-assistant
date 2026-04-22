import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout }    = useAuth();
  const location            = useLocation();
  const navigate            = useNavigate();
  const [open, setOpen]     = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-dark-900/80 backdrop-blur-md border-b border-dark-600">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <span className="text-2xl select-none">🎙️</span>
          <span className="font-bold text-white text-base tracking-tight group-hover:text-violet-light transition-colors">
            VoiceAssist
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {[
            { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
            { path: '/profile',   label: 'Profile',   icon: '⚙️' },
          ].map(({ path, label, icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                isActive(path)
                  ? 'bg-violet text-white shadow-lg shadow-violet/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-600'
              }`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((p) => !p)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-dark-600 transition-colors"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full ring-2 ring-dark-400" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-violet flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className="text-sm text-gray-300 hidden sm:block max-w-[120px] truncate">
              {user?.name}
            </span>
            <span className="text-gray-500 text-xs">▾</span>
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-dark-700 border border-dark-500 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-dark-500">
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <div className="p-1">
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-dark-600 hover:text-white transition-colors"
                >
                  ⚙️ Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-danger hover:bg-red-950/40 transition-colors"
                >
                  🚪 Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}