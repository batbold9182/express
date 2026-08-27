import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { API_BASE } from '../lib/api';

const BRAND_GRADIENT = 'linear-gradient(90deg, #4FA3D1 0%, #FFFFFF 50%, #E0685C 100%)';

// Fluid scale. clamp(min, preferred, max) interpolates against viewport width, so type and
// spacing grow smoothly between sizes instead of jumping at a breakpoint — that continuity is
// what makes the page feel like one design at every width.
const LAYOUT_MAX   = '1240px';                          // stops the composition spreading on ultrawide
const GUTTER       = 'clamp(1.25rem, 4vw, 3.5rem)';     // 20px → 56px page inset
const WORDMARK_SIZE = 'clamp(2.5rem, 6vw, 3.5rem)';     // 40px → 56px
const TAGLINE_SIZE  = 'clamp(0.8125rem, 1.4vw, 0.9375rem)'; // 13px → 15px

const FEATURES = [
  { icon: '★', color: '#4FA3D1', label: 'Rate tracks, albums & artists 0–10' },
  { icon: '♪', color: '#FFFFFF', label: 'Build a profile that shows your taste' },
  { icon: '◎', color: '#E0685C', label: "Follow people, see what they're loving" },
];

// TODO: dummy for now — wire up i18n and real policy pages later.
const LANGUAGES = ['English (US)', 'Polski', 'Deutsch', 'Español'];
const POLICY_LINKS = ['Privacy Policy', 'Cookies', 'Terms' , 'Report'];

type EmailMode = 'signin' | 'signup';

export default function Login() {
  const { token, saveToken } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<EmailMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (token) nav('/', { replace: true }); }, [token]);

  async function submitEmail() {
    setError('');

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match'); return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/email-login';
      const body = mode === 'signup'
        ? { email, displayName: name, password }
        : { email, password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { access_token?: string; spotify_id?: string; error?: string };

      if (!res.ok || !data.access_token || !data.spotify_id) {
        setError(data.error ?? 'Something went wrong'); return;
      }

      saveToken(data.access_token, data.spotify_id);
      nav('/', { replace: true });
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: EmailMode) {
    setMode(m);
    setError('');
    setPassword('');
    setConfirm('');
    setShowPassword(false);
    setShowConfirm(false);
  }

  return (
    // 100svh (not 100vh) so mobile browser chrome can't push the footer off-screen.
    <div className="min-h-svh flex flex-col relative overflow-hidden" style={{ background: '#050505' }}>
      {/* Ambient wash — cool top-left, warm bottom-right, matching the wordmark ramp */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 50% at 30% 32%, rgba(79,163,209,0.10) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 55% at 78% 78%, rgba(224,104,92,0.11) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 45% at 32% 30%, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />
      </div>

      {/* ═══ Main row — capped so the composition stays together on ultrawide ═══ */}
      <main
        className="relative flex-1 w-full mx-auto flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-8"
        style={{ maxWidth: LAYOUT_MAX, padding: GUTTER }}
      >
        {/* ─── Left — full brand mark (lg and up) ─── */}
        <section className="hidden lg:flex flex-1 items-center justify-center">
          <div className="relative aspect-square flex items-center justify-center" style={{ width: 'min(40vw, 440px)' }}>
            {/* Soft halo behind the mark */}
            <div
              className="absolute inset-0 rounded-full blur-3xl opacity-35 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 38%, rgba(79,163,209,0.45) 0%, rgba(224,104,92,0.28) 48%, transparent 70%)' }}
            />
            {/* Faint ring */}
            <div className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.055)' }} />

            <div className="relative flex flex-col items-center px-12 text-center">
              <Wordmark />
              <p className="tracking-wide mt-3" style={{ color: '#978A74', fontSize: TAGLINE_SIZE }}>
                Rate music. Build your taste.
              </p>

              <div className="w-12 h-px my-5" style={{ background: 'rgba(255,255,255,0.10)' }} />

              <div className="flex flex-col gap-3.5">
                {FEATURES.map(({ icon, color, label }) => (
                  <div key={label} className="flex items-center gap-3 text-left">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px]"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color }}
                    >
                      {icon}
                    </span>
                    <span className="text-[13px] leading-snug" style={{ color: '#978A74' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── Compact brand (below lg) — the identity relocates, it never disappears ─── */}
        <div className="lg:hidden flex flex-col items-center text-center shrink-0">
          <Wordmark />
          <p className="tracking-wide mt-2.5" style={{ color: '#978A74', fontSize: TAGLINE_SIZE }}>
            Rate music. Build your taste.
          </p>
        </div>

        {/* ─── Right — auth card ─── */}
        <section className="w-full lg:w-[42%] flex justify-center lg:justify-end">
          <div
            className="w-full max-w-[400px] rounded-2xl px-7 sm:px-8 pt-7 pb-8"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            }}
          >
            {/* Tabs */}
            <nav className="flex items-center justify-between">
              {(['signin', 'signup'] as EmailMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className="relative pb-2.5 text-[13px] font-semibold cursor-pointer transition-colors duration-150"
                  style={{ color: mode === m ? '#FFFFFF' : '#5C5142' }}
                >
                  {m === 'signin' ? 'Login' : 'Create account'}
                  {mode === m && (
                    <span
                      className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full"
                      style={{ background: BRAND_GRADIENT }}
                    />
                  )}
                </button>
              ))}
            </nav>

            {/* Heading */}
            <header className="text-center mt-9 mb-6">
              <h2
                className="text-[22px] font-bold leading-tight bg-clip-text text-transparent"
                style={{ backgroundImage: BRAND_GRADIENT }}
              >
                {mode === 'signin' ? 'Welcome to express' : 'Create your account'}
              </h2>
              <p className="text-[12px] mt-2 leading-snug" style={{ color: '#978A74' }}>
                {mode === 'signin'
                  ? 'Sign in to pick up where you left off.'
                  : 'Start rating and build your taste profile.'}
              </p>
            </header>

            {/* Form */}
            <form onSubmit={e => { e.preventDefault(); void submitEmail(); }} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <Field
                  icon={<UserIcon />}
                  type="text"
                  placeholder="Display name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              )}
              <Field
                icon={<MailIcon />}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
              <Field
                icon={<LockIcon />}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                trailing={
                  <RevealButton shown={showPassword} onClick={() => setShowPassword(v => !v)} />
                }
              />
              {mode === 'signup' && (
                <Field
                  icon={<LockIcon />}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  trailing={
                    <RevealButton shown={showConfirm} onClick={() => setShowConfirm(v => !v)} />
                  }
                />
              )}

              {error && <p className="text-[12px] text-center leading-snug" style={{ color: '#E0685C' }}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-xl font-bold text-[14px] cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: BRAND_GRADIENT, color: '#0A0A0A' }}
              >
                {loading ? '…' : (
                  <span className="inline-flex items-center gap-2">
                    {mode === 'signin' ? 'Login' : 'Create account'}
                    <span aria-hidden>→</span>
                  </span>
                )}
              </button>
            </form>

            {/* Fine print */}
            <div className="text-center mt-5 flex flex-col gap-1.5">
              {mode === 'signin' && (
                <Link to="/forgot-password" className="text-[12px] transition-colors hover:text-white" style={{ color: '#978A74' }}>
                  Forgot password?
                </Link>
              )}
              <p className="text-[10.5px] leading-relaxed" style={{ color: '#5C5142' }}>
                By continuing you agree to our terms.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ═══ Footer — languages left, policies right (all placeholders) ═══ */}
      <footer
        className="relative w-full mx-auto pb-6 pt-2"
        style={{ maxWidth: LAYOUT_MAX, paddingLeft: GUTTER, paddingRight: GUTTER }}
      >
        {/* Stacks and centres on narrow screens, splits left/right from sm up */}
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 sm:gap-6 text-[11px]">
          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
            <PlaceholderLink active>
              <span className="inline-flex items-center gap-1">
                {LANGUAGES[0]}
                <ChevronDown />
              </span>
            </PlaceholderLink>
            {LANGUAGES.slice(1).map(lang => (
              <PlaceholderLink key={lang}>{lang}</PlaceholderLink>
            ))}
          </div>

          <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
            {POLICY_LINKS.map(label => (
              <PlaceholderLink key={label}>{label}</PlaceholderLink>
            ))}
            <span style={{ color: '#5C5142' }}>© {new Date().getFullYear()} express</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────── Brand ─────────── */

// One wordmark, two placements — inside the circle on lg+, above the card below it.
function Wordmark() {
  return (
    <h1
      className="font-bold leading-none tracking-tight bg-clip-text text-transparent"
      style={{ backgroundImage: BRAND_GRADIENT, fontSize: WORDMARK_SIZE }}
    >
      express
    </h1>
  );
}

/* ─────────── Form primitives ─────────── */

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
};

function Field({ icon, trailing, ...props }: FieldProps) {
  return (
    <div className="relative">
      <span
        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
        style={{ color: '#5C5142' }}
      >
        {icon}
      </span>
      <input
        {...props}
        className={`w-full pl-10 ${trailing ? 'pr-11' : 'pr-4'} py-3 rounded-xl text-[14px] outline-none transition-all duration-150`}
        style={{
          background: 'rgba(0,0,0,0.35)',
          color: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(255,255,255,0.55)';
          e.target.style.boxShadow = '0 0 0 3px rgba(79,163,209,0.16)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(255,255,255,0.10)';
          e.target.style.boxShadow = 'none';
        }}
      />
      {trailing && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">{trailing}</span>
      )}
    </div>
  );
}

function RevealButton({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? 'Hide password' : 'Show password'}
      className="p-1.5 rounded-lg transition-colors cursor-pointer hover:text-white"
      style={{ color: '#5C5142' }}
    >
      {shown ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

// Non-functional footer entry — real language switching and policy pages are still to come.
function PlaceholderLink({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      title="Coming soon"
      className="transition-colors duration-150 hover:text-white cursor-pointer"
      style={{ color: active ? '#C9BCA6' : '#5C5142' }}
    >
      {children}
    </button>
  );
}

/* ─────────── Icons ─────────── */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke}>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.55 3.53M6.1 6.1A17.8 17.8 0 0 0 2 11s3.6 7 10 7a9 9 0 0 0 4.2-1" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" {...stroke}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
