import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, VStack } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { ActivityLevelPicker, type ActivityLevel } from '@/features/profile/ActivityLevelPicker';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Niveau d'activité au quotidien. Demandé après le premier profil, et aux adhérents
 * déjà inscrits qui ne l'ont pas encore renseigné (à leur prochaine connexion).
 */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const { userId, profile, refresh } = useAuth();
  const [value, setValue] = useState<ActivityLevel | null>(profile?.activity_level ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!userId || !value) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ activity_level: value })
        .eq('id', userId);
      if (updateError) throw updateError;
      await refresh();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={t('onboarding.activityTitle')} subtitle={t('onboarding.activitySubtitle')}>
      <VStack gap="md">
        <ActivityLevelPicker value={value} onChange={setValue} disabled={busy} />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button
          label={t('onboarding.continue')}
          size="lg"
          loading={busy}
          disabled={!value}
          onPress={() => void save()}
          fullWidth
        />
        <Button variant="ghost" label={t('auth.signOut')} onPress={() => void signOut()} />
      </VStack>
    </AuthLayout>
  );
}
