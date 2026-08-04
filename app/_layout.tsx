import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/contexts/auth-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerForPushNotifications } from '@/lib/notifications';
import { setPendingInviteCode } from '@/lib/pending-invite';

export const unstable_settings = {
  anchor: '(tabs)',
};

const queryClient = new QueryClient();

// On web the screens are capped to a centered max-width column; React Navigation
// paints each scene with theme.colors.background, and DefaultTheme's is gray
// (rgb(242,242,242)) — which would show as bands beside the white screens on a
// wide browser. Match the page to the app's white background on web only, so
// native keeps its default scene background (byte-identical to before).
const LightNavTheme =
  Platform.OS === 'web'
    ? { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#fff', card: '#fff' } }
    : DefaultTheme;

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : LightNavTheme}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, profile, isLoading } = useAuth();
  // The URL that opened the app (deep link), plus any later ones while running.
  const url = Linking.useURL();

  useEffect(() => {
    if (profile) {
      registerForPushNotifications(profile.id);
    }
  }, [profile]);

  // Capture an invite code from a deep link (hoverbirdreactnative://…?code=NNNNNN)
  // and stash it. It's consumed by the redeem form once the user reaches it —
  // which may be several screens (sign-up, complete-profile) later.
  useEffect(() => {
    if (!url) return;
    const code = Linking.parse(url).queryParams?.code;
    if (typeof code === 'string' && /^\d{6}$/.test(code)) {
      setPendingInviteCode(code);
    }
  }, [url]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !profile}>
        <Stack.Screen name="complete-profile" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !!profile}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
