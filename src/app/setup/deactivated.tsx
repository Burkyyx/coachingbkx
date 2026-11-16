import { useTranslation } from 'react-i18next';

import { Button, EmptyState } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { AuthLayout } from '@/features/auth/components';

export default function DeactivatedScreen() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('auth.deactivatedTitle')}>
      <EmptyState
        icon="lock-closed-outline"
        title={t('auth.deactivatedTitle')}
        body={t('auth.deactivatedBody')}
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
