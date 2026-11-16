import { useTranslation } from 'react-i18next';

import { Button, EmptyState } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components';

export default function UnderageScreen() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('onboarding.underageTitle')}>
      <EmptyState
        icon="hand-left-outline"
        title={t('onboarding.underageTitle')}
        body={t('onboarding.underageBody')}
      />
      <Button
        variant="secondary"
        label={t('auth.signOut')}
        onPress={() => void signOut()}
        fullWidth
      />
    </AuthLayout>
  );
}
