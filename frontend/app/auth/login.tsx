import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { C, R } from "../theme";
import * as ExpoLinking from "expo-linking";

function SpotifyIcon() {
    return (
        <Svg width={20} height={20} viewBox="0 0 24 24">
            <Circle cx="12" cy="12" r="12" fill="#1DB954" />
            <Path d="M17.5 16.5c-.2 0-.4-.1-.5-.2-2-1.2-4.5-1.5-7.5-.8-.3.1-.6-.1-.7-.4-.1-.3.1-.6.4-.7 3.3-.7 6.1-.4 8.4.9.3.2.4.5.2.8-.1.2-.2.4-.3.4z" fill="#000" />
            <Path d="M18.5 13.8c-.2 0-.4-.1-.6-.2-2.3-1.4-5.8-1.8-8.5-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 3.1-.9 6.9-.5 9.6 1.1.3.2.4.6.2.9-.1.3-.3.5-.4.5z" fill="#000" />
            <Path d="M19.5 11c-.2 0-.3 0-.5-.1-2.6-1.6-6.9-1.7-9.4-1-.4.1-.8-.1-.9-.5-.1-.4.1-.8.5-.9 2.8-.8 7.5-.6 10.4 1.1.4.2.5.6.3 1-.1.2-.3.4-.4.4z" fill="#000" />
        </Svg>
    );
}

function getSpotifyAuthURL() {
    const successURL = ExpoLinking.createURL('auth/success');
    return `${process.env.EXPO_PUBLIC_API_BASE}/auth/login?redirect=${encodeURIComponent(successURL)}`;
}

export default function Login() {
    const insets = useSafeAreaInsets();

    return (
        <View style={[s.screen, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
            <View style={s.bgGlow} pointerEvents="none" />

            <View style={s.hero}>
                <LinearGradient
                    colors={["#B14EFF", "#FF3FA4"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.logoMark}
                />
                <MaskedView maskElement={<Text style={s.appName}>express</Text>}>
                    <LinearGradient
                        colors={["#00D9FF", "#B14EFF", "#FF3FA4"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={[s.appName, { opacity: 0 }]}>express</Text>
                    </LinearGradient>
                </MaskedView>
                <Text style={s.tagline}>rate the music you love</Text>
            </View>

            <TouchableOpacity activeOpacity={0.8} style={s.btnSpotify} onPress={() => Linking.openURL(getSpotifyAuthURL())}>
                <SpotifyIcon />
                <Text style={s.btnSpotifyTxt}>Continue with Spotify</Text>
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: C.bg,
        paddingHorizontal: 28,
        justifyContent: "center",
        gap: 32,
    },
    bgGlow: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '60%',
        backgroundColor: 'rgba(177,78,255,0.06)',
    },
    hero: {
        alignItems: "center",
        gap: 8,
    },
    logoMark: {
        width: 64,
        height: 64,
        borderRadius: R.r3,
        marginBottom: 4,
    },
    appName: {
        fontSize: 32,
        fontWeight: "700",
        color: C.fg,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 14,
        color: C.fg3,
        letterSpacing: 0.3,
    },
    btnSpotify: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 54,
        borderRadius: R.pill,
        backgroundColor: "#1DB954",
    },
    btnSpotifyTxt: {
        color: "#000",
        fontSize: 15,
        fontWeight: "700",
    },
});
