import { Stack, router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useAuth, type AuthStatus } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

const ROUTE_BY_STATUS: Partial<Record<AuthStatus, Href>> = {
  needsInvitation: '/setup/invitation',
  needsConsent: '/setup/consents',
  needsOnboarding: '/setup/onboarding',
  needsActivity: '/setup/activity',
  deactivated: '/setup/deactivated',
  underage: '/setup/underage',
};

/**
 * Étapes de fin d'inscription. Dès qu'une étape est terminée, l'utilisateur est
 * envoyé automatiquement vers la suivante (il ne peut pas sauter d'étape).
 */
export default function SetupLayout() {
  const theme = useTheme();
  const { status } = useAuth();
  const pathname = usePathname();
  const target = ROUTE_BY_STATUS[status];

  useEffect(() => {
    if (target && pathname !== target) router.replace(target);
  }, [target, pathname]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
