import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { sessionActions } from '@/features/training/session/store';
import { useSyncManager } from '@/offline/sync';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Espace adhérent : onglets + écrans plein écran (mode séance, bilan, messages…).
 * La synchronisation hors-ligne et la reprise d'une séance interrompue démarrent ici.
 */
export default function AdherentLayout() {
  const theme = useTheme();
  const { userId } = useAuth();
  useSyncManager();
  useEffect(() => {
    if (userId) void sessionActions.hydrate(userId);
  }, [userId]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="session/[workoutId]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
