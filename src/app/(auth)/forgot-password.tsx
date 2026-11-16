import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, TextField, VStack } from '@/components/ui';
import { sendPasswordReset } from '@/features/auth/api';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { makeEmailSchema } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const schema = useMemo(() => makeEmailSchema(t), [t]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthLayout title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <VStack gap="md">
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              label={t('auth.email')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={formState.errors.email?.message}
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {sent ? <FormMessage tone="info">{t('auth.resetSent')}</FormMessage> : null}
        <Button
          label={t('auth.resetSend')}
          size="lg"
          loading={busy}
          onPress={() => void onSubmit()}
          fullWidth
        />
        <Button
          variant="ghost"
          label={t('common.back')}
          onPress={() => router.replace('/sign-in')}
        />
      </VStack>
    </AuthLayout>
  );
}
