import { useTranslation } from 'react-i18next';

import { Screen, Text } from '@/components/ui';

export default function Page() {
  const { t } = useTranslation();
  return (
    <Screen>
      <Text variant="headline" accessibilityRole="header">
        {t('nav.adherents')}
      </Text>
    </Screen>
  );
}
