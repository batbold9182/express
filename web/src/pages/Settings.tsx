import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { ChatBubbleIcon, AdminIcon, LogoutIcon } from '../components/icons';

type MeInfo = { displayName?: string; email?: string };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">{children}</p>;
}

export default function Settings() {
  const { token, clearToken } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState<MeInfo | null>(null);

  useEffect(() => {
    if (!token) return;
    api.get('/users/me').then((d: MeInfo) => setMe(d)).catch(() => {});
  }, [token]);

  function logout() {
    if (!window.confirm('Log out?')) return;
    clearToken();
    nav('/login', { replace: true });
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/8" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 pb-20 flex flex-col gap-9">
        {/* Account */}
        <section>
          <SectionLabel>Account</SectionLabel>
          <div className="rounded-2xl border border-white/8 bg-white/4 divide-y divide-white/6">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-fg3">Display name</span>
              <span className="text-[13px] font-medium text-fg truncate max-w-[60%] text-right">{me?.displayName ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-fg3">Email</span>
              <span className="text-[13px] font-medium text-fg truncate max-w-[60%] text-right">{me?.email ?? '—'}</span>
            </div>
          </div>
          <p className="text-[11px] text-fg4 mt-2">Editing your name and avatar is coming soon.</p>
        </section>

        {/* Feedback */}
        <section>
          <SectionLabel>Feedback</SectionLabel>
          <Link
            to="/feedback"
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3.5 hover:bg-white/8 transition-colors"
          >
            <ChatBubbleIcon size={17} />
            <span className="flex-1 text-[13px] font-medium text-fg">Report a bug or request a feature</span>
            <span className="text-fg4 text-sm">›</span>
          </Link>
        </section>

        {/* Admin */}
        <section>
          <SectionLabel>Admin</SectionLabel>
          <Link
            to="/admin/feedback"
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3.5 hover:bg-white/8 transition-colors"
          >
            <AdminIcon size={16} />
            <span className="flex-1 text-[13px] font-medium text-fg">Read feedback</span>
            <span className="text-fg4 text-sm">›</span>
          </Link>
          <p className="text-[11px] text-fg4 mt-2">Only visible to the admin account.</p>
        </section>

        {/* Log out */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-[13px] font-semibold text-fg2 hover:bg-white/5 hover:text-fg transition-colors cursor-pointer"
        >
          <LogoutIcon size={15} />
          Log out
        </button>

        <p className="text-center text-fg4 text-[11px]">express</p>
      </div>
    </div>
  );
}
