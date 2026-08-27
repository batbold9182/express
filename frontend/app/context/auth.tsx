import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureRefresh } from "../lib/api";

const TOKEN_KEY      = "spotify_access_token";
const SPOTIFY_ID_KEY = "spotify_id";
const EXPIRES_AT_KEY = "spotify_token_expires_at";
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh if within 5 min of expiry

type AuthCtx = {
    token: string | null;
    spotifyId: string | null;
    loading: boolean;
    saveToken: (t: string, id: string, expiresAt: number) => Promise<void>;
    updateToken: (t: string, expiresAt: number) => Promise<void>;
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
    const [token, setToken]         = useState<string | null>(null);
    const [spotifyId, setSpotifyId] = useState<string | null>(null);
    const [loading, setLoading]     = useState(true);

    const BASE = process.env.EXPO_PUBLIC_API_BASE;

    function wireRefresh(id: string) {
        configureRefresh({
            spotifyId: id,
            onNewToken: (newToken, expiresAt) => {
                AsyncStorage.multiSet([[TOKEN_KEY, newToken], [EXPIRES_AT_KEY, String(expiresAt)]]);
                setToken(newToken);
            },
            onAuthFailure: () => {
                AsyncStorage.multiRemove([TOKEN_KEY, SPOTIFY_ID_KEY, EXPIRES_AT_KEY]);
                setToken(null);
                setSpotifyId(null);
            },
        });
    }

    useEffect(() => {
        Promise.all([
            AsyncStorage.getItem(TOKEN_KEY),
            AsyncStorage.getItem(SPOTIFY_ID_KEY),
            AsyncStorage.getItem(EXPIRES_AT_KEY),
        ]).then(async ([t, id, expiresAtStr]) => {
            if (t && id) {
                const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;
                let activeToken = t;
                if (expiresAt - Date.now() < REFRESH_THRESHOLD_MS) {
                    console.log('[auth] pre-emptive refresh triggered, expires in', Math.round((expiresAt - Date.now()) / 1000), 's');
                    try {
                        const res = await fetch(`${BASE}/auth/refresh`, {
                            method: 'POST',
                            // Identity comes from the token now, not the spotifyId in the body.
                            headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ spotifyId: id }),
                        });
                        if (res.ok) {
                            const { access_token, expires_in } = await res.json();
                            const newExpiresAt = Date.now() + (expires_in ?? 3600) * 1000;
                            activeToken = access_token;
                            await AsyncStorage.multiSet([
                                [TOKEN_KEY, access_token],
                                [EXPIRES_AT_KEY, String(newExpiresAt)],
                            ]);
                        }
                    } catch {
                        // silent — reactive 401 refresh is the fallback
                    }
                }
                setToken(activeToken);
                setSpotifyId(id);
                wireRefresh(id);
            }
            setLoading(false);
        });
    }, []);

    const saveToken = async (t: string, id: string, expiresAt: number) => {
        await AsyncStorage.multiSet([[TOKEN_KEY, t], [SPOTIFY_ID_KEY, id], [EXPIRES_AT_KEY, String(expiresAt)]]);
        setToken(t);
        setSpotifyId(id);
        wireRefresh(id);
    };

    const updateToken = async (t: string, expiresAt: number) => {
        await AsyncStorage.multiSet([[TOKEN_KEY, t], [EXPIRES_AT_KEY, String(expiresAt)]]);
        setToken(t);
    };

    const clearToken = async () => {
        await AsyncStorage.multiRemove([TOKEN_KEY, SPOTIFY_ID_KEY, EXPIRES_AT_KEY]);
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
