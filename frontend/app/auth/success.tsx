import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { C } from "../theme";
import { useAuth } from "../context/auth";

export default function AuthSuccess() {
    const { access_token, spotify_id, expires_at } = useLocalSearchParams<{ access_token: string; spotify_id: string; expires_at: string }>();
    const { saveToken } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!access_token || !spotify_id) {
            router.replace("/auth/login");
            return;
        }
        saveToken(access_token, spotify_id, Number(expires_at) || Date.now() + 3600 * 1000).then(() => router.replace("/(tabs)"));
    }, [access_token]);

    return (
        <View style={s.screen}>
            <ActivityIndicator color={C.violet} size="large" />
            <Text style={s.txt}>Signing you in...</Text>
        </View>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 16 },
    txt:    { color: C.fg3, fontSize: 14 },
});
