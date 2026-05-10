import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { C } from './theme';
import { AuthProvider, useAuth } from './context/auth';
import { RateProvider } from './context/rate';

function Guard() {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'auth';
    if (!token && !inAuth) router.replace('/auth/login');
    if (token && inAuth) router.replace('/(tabs)');
  }, [token, loading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RateProvider>
          <StatusBar style="light" />
          <Guard />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/success" />
            <Stack.Screen name="song" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          </RateProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
