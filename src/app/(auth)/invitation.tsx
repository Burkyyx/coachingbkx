import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, TextField, VStack } from '@/components/ui';
import { checkInvitation } from '@/features/auth/api';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { usePendingInvitation } from '@/features/auth/pendingInvitation';
import { makeInvitationSchema } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';

/**
 * Étape 1 de l'inscription : saisie du code d'invitation.
 * Le lien d'invitation (…/invitation?code=XXXX) pré-remplit le code.
 */
export default function InvitationScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string }>();
  const schema = useMemo(() => makeInvitationSchema(t), [t]);
  const setPendingCode = usePendingInvitation((s) => s.setCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { code: typeof params.code === 'string' ? params.code : '' },
  });

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    setBusy(true);
    try {
      if (await checkInvitation(code)) {
        setPendingCode(code);
        router.push('/sign-up');
      } else {
        setError(t('auth.invitationInvalid'));
      }
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthLayout title={t('auth.invitationTitle')} subtitle={t('auth.invitationSubtitle')}>
      <VStack gap="md">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextField
              label={t('auth.invitationCode')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              placeholder="ABCD2345"
              onSubmitEditing={() => void onSubmit()}
              error={formState.errors.code?.message}
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button
          label={t('auth.invitationCheck')}
          size="lg"
          loading={busy}
          onPress={() => void onSubmit()}
          fullWidth
        />
        <Button
          variant="ghost"
          label={t('auth.alreadyAccount')}
          onPress={() => router.replace('/sign-in')}
        />
      </VStack>
    </AuthLayout>
  );
}
