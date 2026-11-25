import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Checkbox, Segmented, Text, TextField, VStack } from '@/components/ui';
import { maskFrenchDate, parseFrenchDate } from '@/core';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { CONSENT_VERSION, hasActiveConsent } from '@/features/auth/consents';
import { saveWeight } from '@/features/checkin/api';
import { AuthLayout, FormMessage } from '@/features/auth/components';
import { toUserMessage } from '@/lib/errors';
import { supabase, type Enums } from '@/lib/supabase';

/** Choix à l'inscription (« Autre » retiré) : sert aussi au calcul des besoins (Mifflin-St Jeor). */
const SEXES = ['female', 'male'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const GOALS = ['muscle_gain', 'fat_loss', 'recomposition', 'performance', 'health'] as const;

/** Premier profil de l'adhérent : aide le coach à adapter le programme. */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { userId, profile, consents, refresh } = useAuth();
  // Le poids est une donnée corporelle : consentement « données corporelles » requis.
  const healthConsent = hasActiveConsent(consents, 'health_data');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
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
          weight: z
            .string()
            .refine(
              (v) => v.trim() === '' || parseWeight(v) !== null,
              t('onboarding.weightInvalid'),
            ),
          healthConsent: z.boolean(),
          level: z.enum(LEVELS).nullable(),
          goal: z.enum(GOALS).nullable(),
          injuries: z.string().max(2000),
        })
        .refine((v) => healthConsent || v.weight.trim() === '' || v.healthConsent, {
          path: ['healthConsent'],
          message: t('onboarding.weightConsentRequired'),
        }),
    [t, healthConsent],
  );

  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile?.first_name ?? '',
      lastName: profile?.last_name ?? '',
      nickname: profile?.nickname ?? '',
      birthDate: '',
      sex: profile?.sex === 'female' || profile?.sex === 'male' ? profile.sex : null,
      height: profile?.height_cm ? String(profile.height_cm) : '',
      weight: '',
      healthConsent: false,
      level: profile?.level ?? null,
      goal: profile?.goal ?? null,
      injuries: profile?.injuries ?? '',
    },
  });

  const weight = useWatch({ control, name: 'weight' });

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
      const weightKg = parseWeight(v.weight);
      if (weightKg !== null) {
        if (!healthConsent) {
          const { error: consentError } = await supabase
            .from('consents')
            .insert({ user_id: userId, type: 'health_data', version: CONSENT_VERSION });
          if (consentError) throw consentError;
        }
        await saveWeight(userId, weightKg);
      }
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
              onChangeText={(v) => field.onChange(maskFrenchDate(v, field.value))}
              placeholder="31/12/1995"
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="birthdate-full"
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
        <Controller
          control={control}
          name="weight"
          render={({ field }) => (
            <TextField
              label={`${t('onboarding.weight')} (${t('common.optional')})`}
              hint={t('onboarding.weightHint')}
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="decimal-pad"
              inputMode="decimal"
              error={formState.errors.weight?.message}
            />
          )}
        />
        {!healthConsent && weight.trim() !== '' ? (
          <Controller
            control={control}
            name="healthConsent"
            render={({ field }) => (
              <VStack gap="xs">
                <Checkbox
                  checked={field.value}
                  onChange={field.onChange}
                  label={t('consents.types.health_data.title')}
                  description={t('consents.types.health_data.body')}
                />
                {formState.errors.healthConsent?.message ? (
                  <Text variant="small" color="danger">
                    {formState.errors.healthConsent.message}
                  </Text>
                ) : null}
              </VStack>
            )}
          />
        ) : null}
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

/** Poids saisi (kg, virgule acceptée) ; null si vide ou hors limites (25–350 kg). */
function parseWeight(text: string): number | null {
  const n = Number(text.replace(',', '.').trim());
  return text.trim() !== '' && Number.isFinite(n) && n >= 25 && n <= 350
    ? Math.round(n * 10) / 10
    : null;
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
