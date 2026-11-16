import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, TextField, VStack } from '@/components/ui';
import { signInWithApple, signInWithGoogle, signUpWithEmail } from '@/features/auth/api';
import { AuthLayout, FormMessage, SocialButtons } from '@/features/auth/components';
import { usePendingInvitation } from '@/features/auth/pendingInvitation';
import { makeSignUpSchema } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';

/** Étape 2 de l'inscription : création du compte (le code est utilisé automatiquement). */
export default function SignUpScreen() {
  const { t } = useTranslation();
  const code = usePendingInvitation((s) => s.code);
  const schema = useMemo(() => makeSignUpSchema(t), [t]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirm: '' },
  });

  if (!code) return <Redirect href="/invitation" />;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = handleSubmit((v) =>
    run(async () => {
      const { needsEmailConfirmation } = await signUpWithEmail(v.email, v.password);
      if (needsEmailConfirmation) setInfo(t('auth.checkEmail'));
    }),
  );

  return (
    <AuthLayout title={t('auth.signUp')} subtitle={t('auth.invitationValid')}>
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
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              error={formState.errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              label={t('auth.password')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              hint={t('auth.errors.passwordTooShort')}
              error={formState.errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field }) => (
            <TextField
              label={t('auth.passwordConfirm')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={() => void onSubmit()}
              error={formState.errors.confirm?.message}
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        {info ? <FormMessage tone="info">{info}</FormMessage> : null}
        <Button
          label={t('auth.signUp')}
          size="lg"
          loading={busy}
          onPress={() => void onSubmit()}
          fullWidth
        />
        <SocialButtons
          loading={busy}
          onGoogle={() => void run(signInWithGoogle)}
          onApple={() => void run(signInWithApple)}
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
