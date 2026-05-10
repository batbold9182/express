import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureRefresh } from "../lib/api";

const TOKEN_KEY      = "spotify_access_token";
const SPOTIFY_ID_KEY = "spotify_id";

type AuthCtx = {
    token: string | null;
    spotifyId: string | null;
    loading: boolean;
    saveToken: (t: string, id: string) => Promise<void>;
    updateToken: (t: string) => Promise<void>;
    clearToken: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
    token: null,
    spotifyId: null,
    loading: true,
    saveToken: async () => {},
    updateToken: async () => {},
    clearToken: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken]       = useState<string | null>(null);
    const [spotifyId, setSpotifyId] = useState<string | null>(null);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem(TOKEN_KEY),
            AsyncStorage.getItem(SPOTIFY_ID_KEY),
        ]).then(([t, id]) => {
            setToken(t);
            setSpotifyId(id);
            if (t && id) {
                configureRefresh({
                    spotifyId: id,
                    onNewToken: (newToken) => { AsyncStorage.setItem(TOKEN_KEY, newToken); setToken(newToken); },
                    onAuthFailure: () => { AsyncStorage.multiRemove([TOKEN_KEY, SPOTIFY_ID_KEY]); setToken(null); setSpotifyId(null); },
                });
            }
            setLoading(false);
        });
    }, []);

    const saveToken = async (t: string, id: string) => {
        await AsyncStorage.multiSet([[TOKEN_KEY, t], [SPOTIFY_ID_KEY, id]]);
        setToken(t);
        setSpotifyId(id);
        configureRefresh({
            spotifyId: id,
            onNewToken: (newToken) => { AsyncStorage.setItem(TOKEN_KEY, newToken); setToken(newToken); },
            onAuthFailure: () => { AsyncStorage.multiRemove([TOKEN_KEY, SPOTIFY_ID_KEY]); setToken(null); setSpotifyId(null); },
        });
    };

    const updateToken = async (t: string) => {
        await AsyncStorage.setItem(TOKEN_KEY, t);
        setToken(t);
    };

    const clearToken = async () => {
        await AsyncStorage.multiRemove([TOKEN_KEY, SPOTIFY_ID_KEY]);
        setToken(null);
        setSpotifyId(null);
    };

    return (
        <AuthContext.Provider value={{ token, spotifyId, loading, saveToken, updateToken, clearToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
