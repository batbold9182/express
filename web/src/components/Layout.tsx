import { NavLink, Link, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/auth';
import { useNotif } from '../context/notif';
import { RateModal } from './RateModal';
import { NowPlaying } from './NowPlaying';
import { Avatar } from './Avatar';
import { api } from '../lib/api';

type MeUser = { displayName: string; avatarUrl?: string; spotifyId: string };

const NAV = [
  { to: '/',              icon: HomeIcon,    label: 'Home'          },
  { to: '/search',        icon: SearchIcon,  label: 'Search'        },
  { to: '/ranking',       icon: TrophyIcon,  label: 'Ranking'       },
  { to: '/notifications', icon: BellIcon,    label: 'Notifications' },
  { to: '/me',            icon: MeIcon,      label: 'Me'            },
];

export function Layout() {
  const { token } = useAuth();
  const { unreadCount } = useNotif();
  const nav = useNavigate();
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get<MeUser>('/users/me')
      .then(u => setMe(u))
      .catch(() => {});
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-white/8 p-4 gap-1 sticky top-0 h-screen">
        <div className="px-3 py-5 mb-2">
          <span className="text-[20px] font-bold bg-gradient-to-r from-violet to-pink bg-clip-text text-transparent">
            express
          </span>
        </div>

        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors relative ${
                isActive
                  ? 'bg-violet/15 text-violet border border-violet/30'
                  : 'text-fg2 hover:bg-white/6 hover:text-fg border border-transparent'
              }`
            }
          >
            <Icon size={18} />
            {label}
            {label === 'Notifications' && unreadCount > 0 && (
              <span className="ml-auto bg-pink text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}

        <NowPlaying />

        <div className="mt-auto pt-4 border-t border-white/8 flex flex-col gap-1">
          {/* User avatar row */}
          {me && (
            <button
              onClick={() => nav('/me')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/6 transition-colors cursor-pointer border border-transparent"
            >
              <Avatar name={me.displayName} src={me.avatarUrl} size={28} />
              <span className="text-[13px] font-semibold text-fg truncate flex-1">{me.displayName}</span>
            </button>
          )}

          <Link
            to="/feedback"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-fg2 hover:bg-white/6 hover:text-fg transition-colors border border-transparent"
          >
            <FeedbackIcon size={17} />
            Feedback
          </Link>
          <Link
            to="/admin/feedback"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-medium text-fg4 hover:bg-white/6 hover:text-fg3 transition-colors border border-transparent"
          >
            <AdminIcon size={15} />
            Read feedback
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t border-white/8 z-40" style={{ background: 'rgba(11,8,22,0.95)', backdropFilter: 'blur(12px)' }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium transition-colors relative ${
                isActive ? 'text-violet' : 'text-fg4'
              }`
            }
          >
            <Icon size={22} />
            {label}
            {label === 'Notifications' && unreadCount > 0 && (
              <span className="absolute top-1 right-1/3 translate-x-3 bg-pink text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <RateModal />
    </div>
  );
}

/* Inline SVG icons */
function HomeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}
function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function TrophyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
    </svg>
  );
}
function BellIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}
function MeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function FeedbackIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
function AdminIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
