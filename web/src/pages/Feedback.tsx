import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const MAX = 1000;
type FeedbackType = 'bug' | 'feature' | 'other';

const TYPES: { value: FeedbackType; label: string; color: string }[] = [
  { value: 'bug',     label: 'Bug',             color: '#E0685C' },
  { value: 'feature', label: 'Feature request',  color: '#FFFFFF' },
  { value: 'other',   label: 'Other',            color: '#4FA3D1' },
];

export default function Feedback() {
  const nav = useNavigate();
  const [type, setType]     = useState<FeedbackType>('bug');
  const [text, setText]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState('');

  async function submit() {
    setError('');
    if (!text.trim()) { setError('Write something first'); return; }
    setLoading(true);
    try {
      await api.post('/feedback', { type, text });
      setDone(true);
    } catch {
      setError('Something went wrong — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/8" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
        <h1 className="text-[18px] font-bold text-fg">Send Feedback</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 pb-20">
        {done ? (
          <div className="flex flex-col items-center gap-5 text-center rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-[40px]">✓</div>
            <div>
              <p className="text-fg font-semibold text-[16px]">Thanks for the feedback!</p>
              <p className="text-fg3 text-[13px] mt-1">We read every submission.</p>
            </div>
            <button
              onClick={() => nav(-1)}
              className="px-6 py-3 rounded-xl font-bold text-[14px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)', color: '#fff' }}
            >
              Go back
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Info banner */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(224,104,92,0.07))', border: '1px solid rgba(255,255,255,0.20)' }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>📬</span>
              <p className="text-[13px] font-medium" style={{ color: '#C4AEFF' }}>
                I read all feedback — checked weekly.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Type</p>
              <div className="flex gap-2">
                {TYPES.map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => setType(value)}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border cursor-pointer transition-all"
                    style={{
                      color:        type === value ? color : '#978A74',
                      borderColor:  type === value ? `${color}60` : 'rgba(255,255,255,0.08)',
                      background:   type === value ? `${color}18` : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-fg3 mb-3">Message</p>
              <textarea
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX))}
                placeholder={type === 'bug' ? 'Describe what happened…' : type === 'feature' ? 'What would you like to see?' : 'Anything on your mind…'}
                rows={6}
                className="w-full text-[14px] text-fg bg-white/5 border border-white/10 rounded-xl p-4 resize-none outline-none focus:border-violet transition-colors placeholder:text-fg4"
              />
              <div className="text-[11px] text-fg4 text-right mt-1">{text.length}/{MAX}</div>
            </div>

            {error && <p className="text-red text-[12px]">{error}</p>}

            <div className="relative group">
              <div
                className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)' }}
              />
              <button
                onClick={submit}
                disabled={loading}
                className="relative w-full py-3.5 rounded-xl font-bold text-[14px] cursor-pointer transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(90deg, #FFFFFF, #E0685C)', color: '#fff' }}
              >
                {loading ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
