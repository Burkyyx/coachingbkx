import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, TextField, VStack } from '@/components/ui';
import { redeemInvitation, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { makeInvitationSchema } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';

/** Compte connecté mais sans invitation (ex. connexion Google sans code) : on demande le code. */
export default function InvitationRequiredScreen() {
  const { t } = useTranslation();
  const { refresh, invitationError } = useAuth();
  const schema = useMemo(() => makeInvitationSchema(t), [t]);
  const [error, setError] = useState<string | null>(invitationError);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    setBusy(true);
    try {
      await redeemInvitation(code);
      await refresh();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthLayout
      title={t('auth.invitationRequiredTitle')}
      subtitle={t('auth.invitationRequiredBody')}
    >
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
              placeholder="ABCD2345"
              error={formState.errors.code?.message}
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button
          label={t('common.continue')}
          size="lg"
          loading={busy}
          onPress={() => void onSubmit()}
          fullWidth
        />
        <Button variant="ghost" label={t('auth.signOut')} onPress={() => void signOut()} />
      </VStack>
    </AuthLayout>
  );
}
