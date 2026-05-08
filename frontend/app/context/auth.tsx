import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "spotify_access_token";

type AuthCtx = {
    token: string | null;
    loading: boolean;
    saveToken: (t: string) => Promise<void>;
    clearToken: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
    token: null,
    loading: true,
    saveToken: async () => {},
    clearToken: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem(TOKEN_KEY).then((t) => {
            setToken(t);
            setLoading(false);
        });
    }, []);

    const saveToken = async (t: string) => {
        await AsyncStorage.setItem(TOKEN_KEY, t);
        setToken(t);
    };

    const clearToken = async () => {
        await AsyncStorage.removeItem(TOKEN_KEY);
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ token, loading, saveToken, clearToken }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
