import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, TextField, VStack } from '@/components/ui';
import { updatePassword } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { makeNewPasswordSchema } from '@/features/auth/schemas';
import { useAutofillSync } from '@/features/auth/autofill';
import { toUserMessage } from '@/lib/errors';

/** Choix d'un nouveau mot de passe (après le lien reçu par e-mail). */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { endRecovery } = useAuth();
  const schema = useMemo(() => makeNewPasswordSchema(t), [t]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });
  const autofill = useAutofillSync<'password' | 'confirm'>((name, value) => setValue(name, value));

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    setBusy(true);
    try {
      await updatePassword(password);
      endRecovery();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  });
  const submit = () => {
    autofill.sync();
    void onSubmit();
  };

  return (
    <AuthLayout title={t('auth.newPasswordTitle')}>
      <VStack gap="md">
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              ref={autofill.bind('password')}
              label={t('auth.password')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="new-password"
              error={formState.errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field }) => (
            <TextField
              ref={autofill.bind('confirm')}
              label={t('auth.passwordConfirm')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              error={formState.errors.confirm?.message}
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button label={t('common.save')} size="lg" loading={busy} onPress={submit} fullWidth />
      </VStack>
    </AuthLayout>
  );
}
