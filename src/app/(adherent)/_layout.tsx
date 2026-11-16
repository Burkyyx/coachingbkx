import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

/** Espace adhérent : onglets + écrans plein écran (mode séance, bilan, messages…). */
export default function AdherentLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
