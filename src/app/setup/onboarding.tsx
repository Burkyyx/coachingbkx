import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Segmented, Text, TextField, VStack } from '@/components/ui';
import { parseFrenchDate } from '@/core';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { toUserMessage } from '@/lib/errors';
import { supabase, type Enums } from '@/lib/supabase';

const SEXES = ['female', 'male', 'other'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const GOALS = ['muscle_gain', 'fat_loss', 'recomposition', 'performance', 'health'] as const;

/** Premier profil de l'adhérent : aide le coach à adapter le programme. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { userId, profile, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        firstName: z.string().trim().min(1, t('common.required')).max(60),
        lastName: z.string().trim().min(1, t('common.required')).max(60),
        nickname: z.string().trim().max(30),
        birthDate: z
          .string()
          .refine((v) => parseFrenchDate(v) !== null, t('onboarding.invalidDate')),
        sex: z.enum(SEXES).nullable(),
        height: z
          .string()
          .refine(
            (v) =>
              v.trim() === '' ||
              (Number(v.replace(',', '.')) >= 80 && Number(v.replace(',', '.')) <= 260),
            t('common.required'),
          ),
        level: z.enum(LEVELS).nullable(),
        goal: z.enum(GOALS).nullable(),
        injuries: z.string().max(2000),
      }),
    [t],
  );

  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
      nickname: profile?.nickname ?? '',
      birthDate: '',
      sex: profile?.sex ?? null,
      height: profile?.height_cm ? String(profile.height_cm) : '',
      level: profile?.level ?? null,
      goal: profile?.goal ?? null,
      injuries: profile?.injuries ?? '',
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: v.firstName,
          last_name: v.lastName,
          nickname: v.nickname || null,
          birth_date: parseFrenchDate(v.birthDate),
          sex: v.sex,
          height_cm: v.height.trim() ? Number(v.height.replace(',', '.')) : null,
          level: v.level,
          goal: v.goal,
          injuries: v.injuries.trim() || null,
          onboarded_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (updateError) throw updateError;
      await refresh();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  });

  const options = <T extends string>(values: readonly T[], prefix: 'sex' | 'level' | 'goal') =>
    values.map((value) => ({ value, label: t(`enums.${prefix}.${value}` as `enums.sex.male`) }));

  return (
    <AuthLayout title={t('onboarding.title')} subtitle={t('onboarding.subtitle')}>
      <VStack gap="md">
        <Controller
          control={control}
          name="firstName"
          render={({ field }) => (
            <TextField
              label={t('onboarding.firstName')}
              value={field.value}
              onChangeText={field.onChange}
              autoComplete="given-name"
              error={formState.errors.firstName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="lastName"
          render={({ field }) => (
            <TextField
              label={t('onboarding.lastName')}
              value={field.value}
              onChangeText={field.onChange}
              autoComplete="family-name"
              error={formState.errors.lastName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="nickname"
          render={({ field }) => (
            <TextField
              label={`${t('onboarding.nickname')} (${t('common.optional')})`}
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="none"
            />
          )}
        />
        <Controller
          control={control}
          name="birthDate"
          render={({ field }) => (
            <TextField
              label={t('onboarding.birthDate')}
              value={field.value}
              onChangeText={field.onChange}
              placeholder="31/12/1995"
              keyboardType="numbers-and-punctuation"
              error={formState.errors.birthDate?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="height"
          render={({ field }) => (
            <TextField
              label={t('onboarding.height')}
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="decimal-pad"
              error={formState.errors.height?.message}
            />
          )}
        />
        <Field label={t('onboarding.sex')}>
          <Controller
            control={control}
            name="sex"
            render={({ field }) => (
              <Segmented
                options={options(SEXES, 'sex')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Field label={t('onboarding.level')}>
          <Controller
            control={control}
            name="level"
            render={({ field }) => (
              <Segmented
                options={options(LEVELS, 'level')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Field label={t('onboarding.goal')}>
          <Controller
            control={control}
            name="goal"
            render={({ field }) => (
              <Segmented
                options={
                  options(GOALS, 'goal') as { value: Enums<'training_goal'>; label: string }[]
                }
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
        <Controller
          control={control}
          name="injuries"
          render={({ field }) => (
            <TextField
              label={`${t('onboarding.injuries')} (${t('common.optional')})`}
              hint={t('onboarding.injuriesHint')}
              value={field.value}
              onChangeText={field.onChange}
              multiline
            />
          )}
        />
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button
          label={t('onboarding.finish')}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <VStack gap="xs">
      <Text variant="small" weight="600" color="textMuted">
        {label}
      </Text>
      {children}
    </VStack>
  );
}
