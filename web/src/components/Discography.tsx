import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALBUM_GROUPS, useArtistAlbums, type AlbumGroup } from '../queries/catalog';
import { ErrorState } from './ErrorState';
import { AlbumGridSkeleton } from './Skeleton';
import { ShowMore } from './ShowMore';

/**
 * The artist page's discography: one tab per release type, each its own cached query, so switching
 * back to a tab you have seen is instant. Each tab shows Spotify's first page of 10; "10 of 54" says
 * when there is more, and "Show more" loads the next 10.
 * A failure (usually Spotify's 429) stays inside this section and never takes the page down.
 */
export function Discography({ artistId, enabled }: { artistId: string; enabled: boolean }) {
  const nav = useNavigate();
  const [group, setGroup] = useState<AlbumGroup>('album');
  const q = useArtistAlbums(artistId, group, enabled);
  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;
  const label = ALBUM_GROUPS.find(g => g.key === group)!.label;

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-fg3">Discography</p>
        {total > items.length && <p className="text-[11px] text-fg4 tabular-nums">{items.length} of {total}</p>}
      </div>

      <div role="tablist" aria-label="Release type" className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
        {ALBUM_GROUPS.map(g => {
          const selected = g.key === group;
          return (
            <button
              key={g.key}
              role="tab"
              aria-selected={selected}
              aria-controls="discography-panel"
              onClick={() => setGroup(g.key)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors cursor-pointer"
              style={{
                borderColor: selected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
                background:  selected ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                color:       selected ? '#FFFFFF' : '#978A74',
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <div id="discography-panel" role="tabpanel" aria-label={label}>
        {q.isPending ? (
          <AlbumGridSkeleton />
        ) : q.isError && q.data === undefined ? (   // a failed *later* page keeps what is loaded (ShowMore offers the retry)
          <ErrorState size="compact" title={`Couldn't load ${label.toLowerCase()}`} error={q.error} onRetry={() => void q.refetch()} />
        ) : items.length === 0 ? (
          <p className="text-fg3 text-[13px] text-center py-6">Nothing here on Spotify.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(a => (
              <button key={a.id} onClick={() => nav(`/album/${a.id}`)} className="flex flex-col gap-2 p-2 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 transition-colors cursor-pointer text-left">
                {a.images[0]?.url ? <img src={a.images[0].url} alt="" className="w-full aspect-square rounded-lg object-cover" /> : <div className="w-full aspect-square rounded-lg bg-white/8" />}
                <p className="text-[12px] font-semibold text-fg truncate">{a.name}</p>
                <p className="text-[11px] text-fg4">{a.release_date?.slice(0, 4)}</p>
              </button>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <ShowMore
            hasMore={!!q.hasNextPage}
            loading={q.isFetchingNextPage}
            error={q.isFetchNextPageError ? q.error : null}
            onMore={() => void q.fetchNextPage()}
          />
        )}
      </div>
    </section>
  );
}
