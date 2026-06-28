import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_BASE as string;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken: token, newPassword: password }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      setDone(true);
    } catch {
      setError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(177,78,255,0.14) 0%, transparent 55%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 60% at 80% 90%, rgba(255,63,164,0.10) 0%, transparent 60%)' }} />
      </div>

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        {/* Wordmark */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <h1
            className="text-[40px] font-bold leading-none tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg, #00D9FF 0%, #B14EFF 50%, #FF3FA4 100%)' }}
          >
            tunelog
          </h1>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-5 text-center rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[32px]">✓</div>
            <div>
              <p className="text-fg font-semibold text-[15px]">Password updated</p>
              <p className="text-fg3 text-[13px] mt-1">You can now sign in with your new password.</p>
            </div>
            <button
              onClick={() => nav('/login')}
              className="w-full py-3.5 rounded-xl font-bold text-[14px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(90deg, #B14EFF, #FF3FA4)', color: '#fff' }}
            >
              Go to Sign in
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-fg font-semibold text-[15px]">Set a new password</p>
              {email && <p className="text-fg3 text-[12px] mt-0.5">{email}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
                style={{ background: 'rgba(0,0,0,0.35)', color: '#E6E2F2', border: '1px solid rgba(255,255,255,0.10)' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(177,78,255,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-150"
                style={{ background: 'rgba(0,0,0,0.35)', color: '#E6E2F2', border: '1px solid rgba(255,255,255,0.10)' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(177,78,255,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
            </div>

            {error && <p className="text-red text-[12px]">{error}</p>}

            <div className="relative group">
              <div
                className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, #B14EFF, #FF3FA4)' }}
              />
              <button
                onClick={submit}
                disabled={loading || !token || !email}
                className="relative w-full py-3.5 rounded-xl font-bold text-[14px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(90deg, #B14EFF, #FF3FA4)', color: '#fff' }}
              >
                {loading ? '…' : 'Reset Password'}
              </button>
            </div>

            <button onClick={() => nav('/login')} className="text-fg4 text-[12px] text-center hover:text-fg3 transition-colors cursor-pointer">
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
