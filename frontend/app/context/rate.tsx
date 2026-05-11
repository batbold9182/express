import React, { createContext, useContext, useState } from 'react';

export type RateItem = {
  type?: 'track' | 'album';
  spotifyTrackId?: string;
  spotifyAlbumId?: string;
  trackName: string;
  artistName: string;
  albumArt: string;
};

type RateCtx = {
  item: RateItem | null;
  setItem: (item: RateItem | null) => void;
};

const RateContext = createContext<RateCtx>({ item: null, setItem: () => {} });

export function RateProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<RateItem | null>(null);
  return <RateContext.Provider value={{ item, setItem }}>{children}</RateContext.Provider>;
}

export const useRate = () => useContext(RateContext);
