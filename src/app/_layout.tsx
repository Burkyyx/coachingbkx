import '@/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button, ErrorState, FeedbackProvider, LoadingState, Text, VStack } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { AuthProvider, useAuth, type AuthStatus } from '@/features/auth/AuthProvider';
import { usePushNotifications } from '@/features/notifications/push';
import { isConfigured } from '@/lib/env';
import { queryClient } from '@/lib/queryClient';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const SETUP_STATUSES: readonly AuthStatus[] = [
  'needsInvitation',
  'needsConsent',
  'needsOnboarding',
  'needsActivity',
  'deactivated',
  'underage',
];

/**
 * Navigation principale : chaque espace n'est accessible que dans le bon état
 * (non connecté, inscription en cours, coach, adhérent).
 */
function RootNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { status, isCoach, refresh, userId } = useAuth();
  usePushNotifications(status === 'ready' ? userId : null);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center' }}>
        <LoadingState />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center' }}>
        <ErrorState onRetry={() => void refresh()} />
        <Button variant="ghost" label={t('auth.signOut')} onPress={() => void signOut()} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={status === 'signedOut'} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={SETUP_STATUSES.includes(status)} redirectTo="/">
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'recovery'} redirectTo="/">
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready' && isCoach} redirectTo="/">
          <Stack.Screen name="coach" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready' && !isCoach} redirectTo="/">
          <Stack.Screen name="(adherent)" />
        </Stack.Protected>
        <Stack.Screen name="legal/[doc]" />
      </Stack>
    </>
  );
}

/** Écran affiché si l'app n'est pas configurée (fichier .env.local manquant). */
function NotConfigured() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <VStack gap="md">
        <Text variant="title">Configuration manquante</Text>
        <Text color="textMuted">
          Copie le fichier .env.example en .env.local et renseigne l’adresse et la clé de ton projet
          Supabase (voir README), puis relance l’app.
        </Text>
      </VStack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {isConfigured ? (
            <AuthProvider>
              <FeedbackProvider>
                <RootNavigator />
              </FeedbackProvider>
            </AuthProvider>
          ) : (
            <NotConfigured />
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
