import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

/** Point d'entrée : envoie chacun vers le bon espace selon son état. */
export default function Index() {
  const { status, isCoach } = useAuth();
  switch (status) {
    case 'signedOut':
      return <Redirect href="/sign-in" />;
    case 'recovery':
      return <Redirect href="/reset-password" />;
    case 'needsInvitation':
      return <Redirect href="/setup/invitation" />;
    case 'deactivated':
      return <Redirect href="/setup/deactivated" />;
    case 'underage':
      return <Redirect href="/setup/underage" />;
    case 'needsConsent':
      return <Redirect href="/setup/consents" />;
    case 'needsOnboarding':
      return <Redirect href="/setup/onboarding" />;
    case 'ready':
      return <Redirect href={isCoach ? '/coach' : '/today'} />;
    default:
      return null;
  }
}
