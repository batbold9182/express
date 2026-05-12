import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Linking } from "react-native";
import * as ExpoLinking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { C, R } from "../theme";

function getSpotifyAuthURL() {
    const redirectBase = ExpoLinking.createURL('').replace(/\/+$/, '');
    return `${process.env.EXPO_PUBLIC_API_BASE}/auth/login?redirect=${encodeURIComponent(redirectBase)}`;
}

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

export default function Login() {
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [focused, setFocused] = useState<"email" | "password" | null>(null);

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: C.bg }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={[s.screen, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
                {/* Logo / wordmark */}
                <View style={s.hero}>
                    <LinearGradient
                        colors={["#B14EFF", "#FF3FA4"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.logoMark}
                    />
                    <Text style={s.appName}>tunelog</Text>
                    <Text style={s.tagline}>rate the music you love</Text>
                </View>

                {/* Form */}
                <View style={s.form}>
                    <View style={[s.inputWrap, focused === "email" && s.inputFocused]}>
                        <TextInput
                            style={s.input}
                            placeholder="Email"
                            placeholderTextColor={C.fg4}
                            value={email}
                            onChangeText={setEmail}
                            onFocus={() => setFocused("email")}
                            onBlur={() => setFocused(null)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={[s.inputWrap, focused === "password" && s.inputFocused]}>
                        <TextInput
                            style={s.input}
                            placeholder="Password"
                            placeholderTextColor={C.fg4}
                            value={password}
                            onChangeText={setPassword}
                            onFocus={() => setFocused("password")}
                            onBlur={() => setFocused(null)}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity activeOpacity={0.8} style={{ borderRadius: R.pill }}>
                        <LinearGradient
                            colors={["#B14EFF", "#FF3FA4"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.btnPrimary}
                        >
                            <Text style={s.btnPrimaryTxt}>Sign in</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7}>
                        <Text style={s.forgotTxt}>Forgot password?</Text>
                    </TouchableOpacity>
                </View>

                {/* Divider */}
                <View style={s.divider}>
                    <View style={s.dividerLine} />
                    <Text style={s.dividerTxt}>or</Text>
                    <View style={s.dividerLine} />
                </View>

                {/* Spotify login */}
                <TouchableOpacity activeOpacity={0.8} style={s.btnSpotify} onPress={() => Linking.openURL(getSpotifyAuthURL())}>
                    <SpotifyIcon />
                    <Text style={s.btnSpotifyTxt}>Continue with Spotify</Text>
                </TouchableOpacity>

                {/* Sign up */}
                <View style={s.signupRow}>
                    <Text style={s.signupTxt}>Don&apos;t have an account? </Text>
                    <TouchableOpacity activeOpacity={0.7}>
                        <Text style={s.signupLink}>Sign up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: 28,
        justifyContent: "center",
        gap: 16,
    },
    hero: {
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    logoMark: {
        width: 52,
        height: 52,
        borderRadius: R.r3,
    },
    appName: {
        fontSize: 28,
        fontWeight: "700",
        color: C.fg,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 13,
        color: C.fg3,
        letterSpacing: 0.3,
    },
    form: {
        gap: 12,
    },
    inputWrap: {
        backgroundColor: C.glass,
        borderWidth: 1,
        borderColor: C.stroke,
        borderRadius: R.r2,
        paddingHorizontal: 16,
        height: 50,
        justifyContent: "center",
    },
    inputFocused: {
        borderColor: C.violet,
    },
    input: {
        color: C.fg,
        fontSize: 15,
    },
    btnPrimary: {
        height: 50,
        borderRadius: R.pill,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: C.violet,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    btnPrimaryTxt: {
        color: "#FFF",
        fontSize: 15,
        fontWeight: "600",
    },
    forgotTxt: {
        color: C.fg3,
        fontSize: 13,
        textAlign: "center",
        marginTop: 2,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginVertical: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.stroke,
    },
    dividerTxt: {
        color: C.fg4,
        fontSize: 12,
        fontWeight: "500",
    },
    btnSpotify: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 50,
        borderRadius: R.pill,
        backgroundColor: C.glass,
        borderWidth: 1,
        borderColor: C.spotify + "55",
    },
    btnSpotifyTxt: {
        color: C.fg,
        fontSize: 15,
        fontWeight: "600",
    },
    signupRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 4,
    },
    signupTxt: {
        color: C.fg3,
        fontSize: 13,
    },
    signupLink: {
        color: C.violet,
        fontSize: 13,
        fontWeight: "600",
    },
});
