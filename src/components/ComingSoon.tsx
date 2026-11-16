import { useTranslation } from 'react-i18next';

import { EmptyState, Screen, Text } from '@/components/ui';

/** Onglet d'une fonctionnalité prévue dans une prochaine phase. */
export function ComingSoon({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      <EmptyState
        icon="time-outline"
        title={t('common.comingSoon')}
        body={t('common.comingSoonBody')}
      />
    </Screen>
  );
}
