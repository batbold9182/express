import { NavLink, Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useNotif } from '../context/notif';
import { RateModal } from './RateModal';
import { HomeIcon, SearchIcon, TrophyIcon, BellIcon, MeIcon, ChatBubbleIcon, LogoutIcon, AdminIcon } from './icons';
import { NowPlaying } from './NowPlaying';

const NAV = [
  { to: '/',              icon: HomeIcon,    label: 'Home'          },
  { to: '/search',        icon: SearchIcon,  label: 'Search'        },
  { to: '/ranking',       icon: TrophyIcon,  label: 'Ranking'       },
  { to: '/notifications', icon: BellIcon,    label: 'Notifications' },
  { to: '/me',            icon: MeIcon,      label: 'Me'            },
];

export function Layout() {
  const { token, clearToken } = useAuth();
  const { unreadCount } = useNotif();

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
            className={({ isActive }: { isActive: boolean }) =>
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
          <button
            onClick={() => { if (window.confirm('Log out?')) clearToken(); }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-fg2 hover:bg-white/6 hover:text-fg transition-colors border border-transparent cursor-pointer text-left"
          >
            <LogoutIcon size={17} />
            Log out
          </button>

          <Link
            to="/feedback"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-fg2 hover:bg-white/6 hover:text-fg transition-colors border border-transparent"
          >
            <ChatBubbleIcon size={17} />
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t border-white/8 z-40" style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)' }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }: { isActive: boolean }) =>
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
