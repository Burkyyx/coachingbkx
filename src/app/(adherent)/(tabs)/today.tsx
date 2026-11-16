import { useTranslation } from 'react-i18next';

import { Button, Screen, Text } from '@/components/ui';
import { signOut } from '@/features/auth/api';

export default function Tab() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Text variant="headline">{t('nav.today' as 'nav.today')}</Text>
      <Button label={t('auth.signOut')} onPress={() => void signOut()} />
    </Screen>
  );
}
