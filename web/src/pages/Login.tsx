import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/auth';

const BASE = import.meta.env.VITE_API_BASE as string;

const FEATURES = [
  { icon: '★', label: 'Rate tracks, albums & artists 0–10' },
  { icon: '♪', label: 'Build a profile that shows your taste' },
  { icon: '◎', label: "Follow people, see what they're loving" },
];

type EmailMode = 'signin' | 'signup';

export default function Login() {
  const { token, saveToken } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<EmailMode>('signin');
  const [showEmail, setShowEmail] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (token) nav('/', { replace: true }); }, [token]);

  function loginWithSpotify() {
    const callbackUrl = `${window.location.origin}/auth/callback`;
    window.location.href = `${BASE}/auth/login?redirect=${encodeURIComponent(callbackUrl)}`;
  }

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

      const res = await fetch(`${BASE}${endpoint}`, {
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
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Layered background gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 20% 10%, rgba(79,163,209,0.08) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 80% 90%, rgba(224,104,92,0.10) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(255,255,255,0.14) 0%, transparent 55%)' }} />
      </div>

      <div className="relative flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div
              className="absolute inset-0 blur-2xl opacity-40 pointer-events-none"
              style={{ background: 'linear-gradient(90deg, #4FA3D1, #FFFFFF, #E0685C)', borderRadius: '50%', transform: 'scale(1.4) translateY(10%)' }}
            />
            <h1
              className="relative text-[52px] font-bold leading-none tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, #4FA3D1 0%, #FFFFFF 50%, #E0685C 100%)' }}
            >
              express
            </h1>
          </div>
          <p className="text-fg3 text-[15px] text-center tracking-wide">Rate music. Build your taste.</p>
        </div>

        {/* Feature bullets */}
        <div className="w-full flex flex-col gap-3">
          {FEATURES.map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-violet text-[13px] w-4 text-center shrink-0">{icon}</span>
              <span className="text-fg2 text-[14px]">{label}</span>
            </div>
          ))}
        </div>

        {/* Auth section */}
        <div className="w-full flex flex-col gap-4">
          {/* Spotify */}
          <div className="relative group">
            <div
              className="absolute inset-0 rounded-2xl blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-300 pointer-events-none"
              style={{ background: '#1DB954' }}
            />
            <button
              onClick={loginWithSpotify}
              className="relative w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2.5 cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-95"
              style={{ background: '#1DB954', color: '#000' }}
            >
              <SpotifyIcon />
              Continue with Spotify
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-fg4 text-[12px] tracking-widest uppercase">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Email toggle */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2.5 cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-95"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <MailIcon />
              Continue with Email
            </button>
          ) : (
            <div className="w-full flex flex-col gap-4 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Sign in / Create account tabs */}
              <div className="flex rounded-xl p-1 gap-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
                {(['signin', 'signup'] as EmailMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className="flex-1 py-2 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-150"
                    style={{
                      background: mode === m ? 'rgba(255,255,255,0.25)' : 'transparent',
                      color: mode === m ? '#FFFFFF' : '#5C5142',
                      border: mode === m ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                    }}
                  >
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={e => { e.preventDefault(); void submitEmail(); }} className="flex flex-col gap-3">
                {mode === 'signup' && (
                  <input
                    type="text"
                    placeholder="Display name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
                    style={{
                      background: 'rgba(0,0,0,0.35)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.6)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.6)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
                {mode === 'signin' && (
                  <div className="text-right -mt-1">
                    <Link to="/forgot-password" className="text-[12px] text-fg4 hover:text-violet transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                )}
                {mode === 'signup' && (
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
                    style={{
                      background: 'rgba(0,0,0,0.35)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'rgba(255,255,255,0.6)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                )}

                {error && (
                  <p className="text-red text-[12px] text-center">{error}</p>
                )}

                <div className="relative group mt-1">
                  <div
                    className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none"
                    style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)' }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full py-3.5 rounded-xl font-bold text-[14px] cursor-pointer transition-transform duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)', color: '#fff' }}
                  >
                    {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="text-[11px] text-fg4 text-center leading-5">
            By continuing you agree to our terms.<br />
            We don't store your Spotify password.
          </p>
        </div>
      </div>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#000">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
