import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { AuthBackdrop, AuthWordmark, AuthInput, GlowButton } from '../components/authKit';

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
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
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
      <AuthBackdrop />

      <div className="relative w-full max-w-sm flex flex-col gap-6">
        {/* Wordmark */}
        <AuthWordmark text="tunelog" />

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
              style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)', color: '#fff' }}
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
              <AuthInput
                type="password"
                placeholder="New password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <AuthInput
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
            </div>

            {error && <p className="text-red text-[12px]">{error}</p>}

            <GlowButton onClick={submit} disabled={loading || !token || !email}>
              {loading ? '…' : 'Reset Password'}
            </GlowButton>

            <button onClick={() => nav('/login')} className="text-fg4 text-[12px] text-center hover:text-fg3 transition-colors cursor-pointer">
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
