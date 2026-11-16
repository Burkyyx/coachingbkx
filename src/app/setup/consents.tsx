import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, HStack, VStack } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import {
  CONSENT_VERSION,
  SIGNUP_CONSENTS,
  hasActiveConsent,
  type ConsentType,
} from '@/features/auth/consents';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** Consentements explicites et séparés (RGPD), demandés à l'inscription. */
export default function ConsentsScreen() {
  const { t } = useTranslation();
  const { userId, consents, refresh } = useAuth();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toGrant = SIGNUP_CONSENTS.filter((type) => !hasActiveConsent(consents, type));
  const allChecked = toGrant.every((type) => checked[type]);

  const accept = async () => {
    if (!userId) return;
    if (!allChecked) {
      setError(t('consents.mustAcceptRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Une éventuelle ancienne version encore active est d'abord révoquée.
      for (const type of toGrant) {
        await supabase
          .from('consents')
          .update({ revoked_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('type', type)
          .is('revoked_at', null);
      }
      const { error: insertError } = await supabase
        .from('consents')
        .insert(toGrant.map((type) => ({ user_id: userId, type, version: CONSENT_VERSION })));
      if (insertError) throw insertError;
      await refresh();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const item = (type: ConsentType) => (
    <Checkbox
      key={type}
      checked={!!checked[type]}
      onChange={(v) => setChecked((c) => ({ ...c, [type]: v }))}
      label={t(`consents.types.${type}.title`)}
      description={t(`consents.types.${type}.body`)}
    />
  );

  return (
    <AuthLayout title={t('consents.title')} subtitle={t('consents.subtitle')}>
      <VStack gap="lg">
        <HStack gap="sm" wrap>
          <Button
            variant="ghost"
            icon="document-text-outline"
            label={t('consents.readTerms')}
            onPress={() => router.push('/legal/terms')}
          />
          <Button
            variant="ghost"
            icon="shield-checkmark-outline"
            label={t('consents.readPrivacy')}
            onPress={() => router.push('/legal/privacy')}
          />
        </HStack>
        {toGrant.map(item)}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button
          label={t('consents.accept')}
          size="lg"
          loading={busy}
          disabled={!allChecked}
          onPress={() => void accept()}
          fullWidth
        />
        <Button variant="ghost" label={t('auth.signOut')} onPress={() => void signOut()} />
      </VStack>
    </AuthLayout>
  );
}
