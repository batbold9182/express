export type NowPlayingData = {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    name: string;
    duration_ms: number;
    artists: { id: string; name: string }[];
    album: {
      id: string;
      name: string;
      images: { url: string }[];
    };
  };
};

/**
 * What the now-playing cards may render, or null for "nothing playing". Only a *playing track* counts:
 * a paused one doesn't, and a podcast episode comes back with `item: null` or an item with no `album`
 * — both of which the cards dereference, and which crashed the whole app before this guard. A local
 * file has no Spotify id (track, album and artists are all null), so there is nothing to rate or open:
 * it counts as nothing playing too.
 */
export function playableTrack(res: NowPlayingData | null | undefined): NowPlayingData | null {
  return res && res.is_playing && res.item?.album && res.item.id ? res : null;
}
