import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button, TextField, VStack } from '@/components/ui';
import { signInWithApple, signInWithEmail, signInWithGoogle } from '@/features/auth/api';
import { AuthLayout, FormMessage, SocialButtons } from '@/features/auth/components';
import { makeSignInSchema } from '@/features/auth/schemas';
import { toUserMessage } from '@/lib/errors';

export default function SignInScreen() {
  const { t } = useTranslation();
  const schema = useMemo(() => makeSignInSchema(t), [t]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

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

  const onSubmit = handleSubmit((v) => run(() => signInWithEmail(v.email, v.password)));

  return (
    <AuthLayout title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')}>
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
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => void onSubmit()}
              error={formState.errors.password?.message}
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button
          label={t('auth.signIn')}
          size="lg"
          loading={busy}
          onPress={() => void onSubmit()}
          fullWidth
        />
        <Link href="/forgot-password" asChild>
          <Button variant="ghost" label={t('auth.forgotPassword')} />
        </Link>
        <SocialButtons
          loading={busy}
          onGoogle={() => void run(signInWithGoogle)}
          onApple={() => void run(signInWithApple)}
        />
        <Button
          variant="secondary"
          icon="key-outline"
          label={t('auth.haveInvitation')}
          onPress={() => router.push('/invitation')}
          fullWidth
        />
      </VStack>
    </AuthLayout>
  );
}
