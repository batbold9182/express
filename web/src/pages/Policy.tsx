import { Link, useNavigate } from 'react-router-dom';
import { AuthBackdrop, AuthWordmark } from '../components/authKit';

// TODO: placeholder pages. The real wording comes from the owner; until then each page only says
// that it is coming, so nothing here reads as a policy the app has actually committed to.
const PAGES = {
  privacy: { title: 'Privacy Policy', other: { to: '/cookies',  label: 'Cookies' } },
  cookies: { title: 'Cookies',        other: { to: '/privacy',  label: 'Privacy Policy' } },
} as const;

/** `/privacy` and `/cookies`. Public, outside the app shell, so they open signed out too. */
export default function Policy({ kind }: { kind: keyof typeof PAGES }) {
  const nav = useNavigate();
  const page = PAGES[kind];

  // Opened from a link inside the app → go back there. Opened directly (a new tab, a pasted URL) →
  // there is nothing to go back to, so go home (which sends a signed-out visitor on to /login).
  function back() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav('/', { replace: true });
  }

  return (
    <div className="min-h-svh flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <AuthBackdrop />

      <div className="relative w-full max-w-md flex flex-col gap-6">
        <AuthWordmark text="express" />

        <article className="flex flex-col gap-4 rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 className="text-fg font-semibold text-[18px]">{page.title}</h1>
          <p className="text-fg3 text-[13px] leading-relaxed">
            This page is being written and will be published here soon.
          </p>
        </article>

        <div className="flex items-center justify-between text-[12px]">
          <button onClick={back} className="text-fg4 hover:text-fg3 transition-colors cursor-pointer">← Back</button>
          <Link to={page.other.to} replace className="text-fg4 hover:text-fg3 transition-colors">{page.other.label}</Link>
        </div>
      </div>
    </div>
  );
}
