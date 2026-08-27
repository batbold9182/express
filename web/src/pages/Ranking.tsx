import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/auth';
import { scoreColor } from '@tunelog/shared';
import { TYPE_CFG, subjectPath } from '../lib/review';
import { TrophyIcon } from '../components/icons';
import { Spinner } from '../components/Spinner';

type TypeFilter = 'most-rated' | 'track' | 'album' | 'artist';

const FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'most-rated', label: 'Most Rated' },
  { key: 'track',      label: 'Tracks'     },
  { key: 'album',      label: 'Albums'     },
  { key: 'artist',     label: 'Artists'    },
];

type LeaderboardItem = {
  type: 'track' | 'album' | 'artist';
  trackName: string;
  artistName: string;
  albumArt?: string;
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  spotifyArtistId?: string;
  avgScore: number;
  reviewCount: number;
};

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Ranking() {
  const { token } = useAuth();
  const nav = useNavigate();

  const [filter,  setFilter]  = useState<TypeFilter>('most-rated');
  const [items,   setItems]   = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.get<{ items: LeaderboardItem[] }>(`/reviews/leaderboard?type=${filter}&limit=100`)
      .then(d => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [filter, token]);

  function navItem(item: LeaderboardItem) {
    const p = subjectPath(item);
    if (p) nav(p);
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div
        className="px-4 pt-4 pb-3 border-b border-white/8 sticky top-0 z-10 shrink-0"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrophyIcon stroke="#FFFFFF" />
          <h1 className="text-[18px] font-bold text-fg">Ranking</h1>
        </div>
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all cursor-pointer"
              style={{
                borderColor: filter === f.key ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  filter === f.key ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                color:       filter === f.key ? '#FFFFFF' : '#978A74',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
        {loading ? (
          <div className="flex justify-center py-24"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center px-8">
            <span className="text-4xl">🏆</span>
            <p className="text-fg font-semibold">No reviews yet</p>
            <p className="text-fg3 text-[13px]">Rate something to see it here.</p>
          </div>
        ) : (
          <div className="flex flex-col max-w-2xl mx-auto p-4 gap-2">
            {items.map((item, idx) => {
              const cfg      = TYPE_CFG[item.type ?? 'track'];
              const scoreCol = scoreColor(item.avgScore);
              const rank     = idx + 1;
              const medal    = MEDALS[rank];
              const isElite  = item.avgScore >= 8.5;

              return (
                <div
                  key={`${item.type}-${item.spotifyTrackId ?? item.spotifyAlbumId ?? item.spotifyArtistId}-${idx}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 border transition-colors hover:bg-white/4 cursor-pointer"
                  onClick={() => navItem(item)}
                  style={{
                    background:  isElite ? `${scoreCol}08` : 'rgba(255,255,255,0.03)',
                    borderColor: isElite ? `${scoreCol}30` : 'rgba(255,255,255,0.07)',
                    borderLeft:  `3px solid ${cfg.color}`,
                  }}
                >
                  {/* Rank */}
                  <div className="w-9 shrink-0 text-center">
                    {medal
                      ? <span className="text-[18px]">{medal}</span>
                      : <span className="text-[13px] font-bold text-fg4">#{rank}</span>}
                  </div>

                  {/* Album art */}
                  {item.albumArt
                    ? <img src={item.albumArt} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/8" />
                    : <div className="w-11 h-11 rounded-xl bg-white/6 border border-white/8 shrink-0" />}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-fg truncate">{item.trackName}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ color: cfg.color, background: `${cfg.color}25` }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-fg3 truncate">{item.artistName}</div>
                    <div className="text-[11px] text-fg4">{item.reviewCount} {item.reviewCount === 1 ? 'review' : 'reviews'}</div>
                  </div>

                  {/* Avg score */}
                  <div
                    className="shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 border"
                    style={{ background: `${scoreCol}12`, borderColor: `${scoreCol}35` }}
                  >
                    <span className="text-[18px] font-bold tabular-nums leading-none" style={{ color: scoreCol }}>
                      {item.avgScore.toFixed(1)}
                    </span>
                    <span className="text-[9px] text-fg4 mt-0.5">avg</span>
                  </div>
                </div>
              );
            })}

            <p className="text-center text-fg4 text-[12px] py-4">Top {items.length} · sorted by {filter === 'most-rated' ? 'review count' : 'average score'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

