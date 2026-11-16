import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { sessionActions } from '@/features/training/session/store';
import { supabase } from '@/lib/supabase';
import { onSynced, useSyncManager } from '@/offline/sync';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Espace adhérent : onglets + écrans plein écran (mode séance, bilan, messages…).
 * La synchronisation hors-ligne et la reprise d'une séance interrompue démarrent ici.
 */
export default function AdherentLayout() {
  const theme = useTheme();
  const { userId, profile } = useAuth();
  useSyncManager();
  useEffect(() => {
    if (userId) void sessionActions.hydrate(userId);
  }, [userId]);
  const restAlarm =
    (profile?.notification_prefs as Record<string, unknown> | null)?.rest_timer !== false;
  useEffect(() => sessionActions.setRestAlarm(restAlarm), [restAlarm]);
  // Dès qu'une séance arrive sur le serveur, on demande son analyse (suggestions pour le coach).
  useEffect(
    () =>
      onSynced(() => {
        void supabase.functions.invoke('compute-suggestions', { body: {} }).catch(() => undefined);
      }),
    [],
  );

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
