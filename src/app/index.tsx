import { useTranslation } from 'react-i18next';

import { Button, Screen, Text, VStack } from '@/components/ui';

export default function Index() {
  const { t } = useTranslation();
  return (
    <Screen>
      <VStack gap="lg" align="center" style={{ paddingTop: 80 }}>
        <Text variant="display">{t('app.name')}</Text>
        <Text color="textMuted">{t('app.tagline')}</Text>
        <Button label={t('auth.signIn')} size="lg" />
      </VStack>
    </Screen>
  );
}
