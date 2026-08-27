import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import { AuthBackdrop, AuthWordmark, AuthInput, GlowButton } from '../components/authKit';

export default function ForgotPassword() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email) { setError('Enter your email address'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { setError('Something went wrong — try again'); return; }
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
        <AuthWordmark text="tunelog" />

        {done ? (
          <div className="flex flex-col items-center gap-5 text-center rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[32px]">✉</div>
            <div>
              <p className="text-fg font-semibold text-[15px]">Check your inbox</p>
              <p className="text-fg3 text-[13px] mt-1">If that email exists, a reset link has been sent. Check your spam folder too.</p>
            </div>
            <button
              onClick={() => nav('/login')}
              className="w-full py-3.5 rounded-xl font-bold text-[14px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)', color: '#fff' }}
            >
              Back to Sign in
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-fg font-semibold text-[15px]">Forgot password?</p>
              <p className="text-fg3 text-[13px] mt-1">Enter your email and we'll send you a reset link.</p>
            </div>

            <AuthInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
            />

            {error && <p className="text-red text-[12px]">{error}</p>}

            <GlowButton onClick={submit} disabled={loading}>
              {loading ? '…' : 'Send reset link'}
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
