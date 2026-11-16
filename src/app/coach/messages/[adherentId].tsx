import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, EmptyState, Screen } from '@/components/ui';

/** Conversation avec un adhérent (livrée à l'étape messagerie). */
export default function Page() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Button
        variant="ghost"
        icon="arrow-back"
        label={t('common.back')}
        onPress={() => router.back()}
      />
      <EmptyState icon="time-outline" title={t('common.comingSoon')} />
    </Screen>
  );
}
