import React, { createContext, useContext, useEffect, useState } from 'react';
import { configureApi } from '../lib/api';

const TOKEN_KEY    = 'tunelog_token';
const SPOTIFY_KEY  = 'tunelog_spotify_id';

type AuthCtx = {
  token: string | null;
  spotifyId: string | null;
  loading: boolean;
  saveToken: (token: string, spotifyId: string) => void;
  clearToken: () => void;
};

const AuthContext = createContext<AuthCtx>({
  token: null, spotifyId: null, loading: true,
  saveToken: () => {}, clearToken: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token,     setToken]     = useState<string | null>(null);
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  function wire(t: string | null) {
    configureApi(t, () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_KEY);
      setToken(null);
      setSpotifyId(null);
    });
  }

  useEffect(() => {
    const t  = localStorage.getItem(TOKEN_KEY);
    const id = localStorage.getItem(SPOTIFY_KEY);
    if (t && id) { setToken(t); setSpotifyId(id); wire(t); }
    setLoading(false);
  }, []);

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
    <AuthContext.Provider value={{ token, spotifyId, loading, saveToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
