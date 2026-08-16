import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { AuthProvider } from '@/providers/auth-provider';

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync();
}

export function AppProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );
  const [loaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' && loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // A static web export must never wait behind font loading. If a font request
  // is slow or unavailable, React Native Web falls back to the system stack
  // and the login screen remains usable instead of rendering a blank page.
  if (Platform.OS !== 'web' && !loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
