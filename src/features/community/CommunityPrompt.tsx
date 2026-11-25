import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasActiveConsent } from '@/features/auth/consents';

import { markCommunityPrompted } from './api';
import { JoinCommunity } from './JoinCommunity';

/**
 * Adhérents inscrits avant l'arrivée de la communauté : proposition faite une seule fois
 * (« Rejoindre » ou « Plus tard » ; ensuite, l'onglet Communauté reste disponible).
 */
export function CommunityPrompt() {
  const { t } = useTranslation();
  const { userId, profile, consents, refresh } = useAuth();
  const [closed, setClosed] = useState(false);
  const show =
    !closed &&
    !!userId &&
    profile?.role === 'adherent' &&
    !!profile.onboarded_at &&
    !profile.community_prompted_at &&
    !hasActiveConsent(consents, 'community');
  if (!show) return null;

  const close = () => {
    setClosed(true);
    void markCommunityPrompted(userId)
      .then(() => refresh())
      .catch(() => undefined);
  };

  return (
    <Sheet visible onClose={close} title={t('community.promptTitle')}>
      <JoinCommunity showLater onDone={() => setClosed(true)} />
    </Sheet>
  );
}
