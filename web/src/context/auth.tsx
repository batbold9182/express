import React, { createContext, useContext, useState } from 'react';
import { configureApi } from '../lib/api';

const TOKEN_KEY    = 'tunelog_token';
const SPOTIFY_KEY  = 'tunelog_spotify_id';

type AuthCtx = {
  token: string | null;
  spotifyId: string | null;
  saveToken: (token: string, spotifyId: string) => void;
  clearToken: () => void;
};

const AuthContext = createContext<AuthCtx>({
  token: null, spotifyId: null,
  saveToken: () => {}, clearToken: () => {},
});

// Both keys must be present — a half-written pair counts as signed out.
function readStored(): { token: string | null; spotifyId: string | null } {
  const token     = localStorage.getItem(TOKEN_KEY);
  const spotifyId = localStorage.getItem(SPOTIFY_KEY);
  return token && spotifyId ? { token, spotifyId } : { token: null, spotifyId: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Read during initialization, not in an effect. Hydrating in an effect renders one frame with
  // token === null, so every load briefly paints the signed-out UI before correcting itself.
  const [token,     setToken]     = useState<string | null>(() => readStored().token);
  const [spotifyId, setSpotifyId] = useState<string | null>(() => readStored().spotifyId);

  function wire(t: string | null) {
    configureApi(t, () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_KEY);
      setToken(null);
      setSpotifyId(null);
    });
  }

  // Deliberately during render rather than in an effect. Child effects run before the parent's,
  // so now that a token exists on the first render, a child would call api.get() before
  // configureApi had set it — an unauthenticated request and an instant 401. configureApi only
  // assigns module-level state, so running it every render is idempotent and keeps the API
  // client in sync with `token` by construction.
  wire(token);

  function saveToken(t: string, id: string) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(SPOTIFY_KEY, id);
    setToken(t);
    setSpotifyId(id);
    wire(t);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_KEY);
    setToken(null);
    setSpotifyId(null);
    wire(null);
  }

  return (
    <AuthContext.Provider value={{ token, spotifyId, saveToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
