import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { timeAgo } from '@tunelog/shared';

type FeedbackItem = {
  _id: string;
  displayName: string;
  email: string;
  type: 'bug' | 'feature' | 'other';
  text: string;
  createdAt: string;
};

const TYPE_STYLE: Record<string, { label: string; color: string }> = {
  bug:     { label: 'Bug',     color: '#FF3FA4' },
  feature: { label: 'Feature', color: '#B14EFF' },
  other:   { label: 'Other',   color: '#00D9FF' },
};

export default function AdminFeedback() {
  const nav = useNavigate();
  const [items, setItems]     = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<'all' | 'bug' | 'feature' | 'other'>('all');

  useEffect(() => {
    api.get<FeedbackItem[]>('/feedback')
      .then(d => setItems(d ?? []))
      .catch(e => setError(e instanceof Error && e.message.startsWith('403') ? 'Only for admin' : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const visible = filter === 'all' ? items : items.filter(i => i.type === filter);
  const counts  = { bug: 0, feature: 0, other: 0 } as Record<string, number>;
  items.forEach(i => { counts[i.type] = (counts[i.type] ?? 0) + 1; });

  return (
    <div className="h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/8 flex items-center gap-3" style={{ background: 'rgba(11,8,22,0.92)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => nav(-1)} className="text-fg3 hover:text-fg transition-colors cursor-pointer text-xl leading-none">←</button>
        <h1 className="text-[18px] font-bold text-fg">Feedback</h1>
        <span className="ml-auto text-[12px] text-fg4">{items.length} total</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-red text-[14px]">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {(['all', 'bug', 'feature', 'other'] as const).map(f => {
                const count = f === 'all' ? items.length : counts[f];
                const color = f === 'all' ? '#E6E2F2' : TYPE_STYLE[f].color;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer transition-all capitalize"
                    style={{
                      color:       filter === f ? color : '#8A7FAC',
                      borderColor: filter === f ? `${color}50` : 'rgba(255,255,255,0.08)',
                      background:  filter === f ? `${color}18` : 'transparent',
                    }}
                  >
                    {f === 'all' ? 'All' : TYPE_STYLE[f].label} {count > 0 && <span className="opacity-60">({count})</span>}
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <p className="text-fg3 text-center text-[13px] py-12">No feedback yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visible.map(item => {
                  const t = TYPE_STYLE[item.type];
                  return (
                    <div key={item._id} className="rounded-2xl border border-white/8 bg-white/4 p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{ color: t.color, background: `${t.color}18`, border: `1px solid ${t.color}40` }}
                        >
                          {t.label}
                        </span>
                        <span className="text-[13px] font-semibold text-fg">{item.displayName}</span>
                        <span className="text-[11px] text-fg4">{item.email}</span>
                        <span className="ml-auto text-[11px] text-fg4">{timeAgo(item.createdAt)}</span>
                      </div>
                      <p className="text-[13px] text-fg2 leading-relaxed whitespace-pre-wrap">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
