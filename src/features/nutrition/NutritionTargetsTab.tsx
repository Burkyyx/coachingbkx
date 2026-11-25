import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  Checkbox,
  HStack,
  LoadingState,
  NumberCell,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  ageOn,
  computeNutritionTargets,
  formatNumber,
  kcalFromMacros,
  NAP_BY_ACTIVITY,
  sessionMinutes,
  todayLocal,
  type NutritionTargets,
} from '@/core';
import { useAdherentWeights } from '@/features/coach/adherent';
import { toUserMessage } from '@/lib/errors';
import type { Tables } from '@/lib/supabase';

import {
  useNutritionTargets,
  usePlannedWeek,
  useSaveNutritionTargets,
  type NutritionTargetsRow,
} from './api';

type Profile = Tables<'profiles'>;

type Form = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  floor_kcal: number | null;
  weekly_rate_target: number | null;
  ai_daily_limit: number | null;
  calories_enabled: boolean;
  coach_note: string;
};

/** Onglet « Nutrition » de la fiche adhérent : calcul proposé + objectifs modifiables. */
export function NutritionTargetsTab({ profile }: { profile: Profile }) {
  const targets = useNutritionTargets(profile.id);
  const weights = useAdherentWeights(profile.id);
  if (targets.isLoading || weights.isLoading || targets.data === undefined) return <LoadingState />;
  const last = weights.data?.at(-1)?.weight_kg;
  return (
    <TargetsEditor
      key={profile.id}
      profile={profile}
      row={targets.data}
      lastWeight={last === undefined ? null : Number(last)}
    />
  );
}

function initialForm(row: NutritionTargetsRow | null, age: number | null): Form {
  return {
    kcal: row?.kcal ?? null,
    protein_g: row?.protein_g ?? null,
    carbs_g: row?.carbs_g ?? null,
    fat_g: row?.fat_g ?? null,
    floor_kcal: row?.floor_kcal ?? null,
    weekly_rate_target:
      row?.weekly_rate_target === null || row?.weekly_rate_target === undefined
        ? null
        : Number(row.weekly_rate_target),
    ai_daily_limit: row?.ai_daily_limit ?? 10,
    // Mineur : suivi des calories désactivé par défaut (spécification §9.5).
    calories_enabled: row ? row.calories_enabled : age === null || age >= 18,
    coach_note: row?.coach_note ?? '',
  };
}

function TargetsEditor({
  profile,
  row,
  lastWeight,
}: {
  profile: Profile;
  row: NutritionTargetsRow | null;
  lastWeight: number | null;
}) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const week = usePlannedWeek(profile.id);
  const save = useSaveNutritionTargets(profile.id);

  const age = profile.birth_date ? ageOn(profile.birth_date, todayLocal()) : null;
  const [weight, setWeight] = useState<number | null>(lastWeight);
  const [nap, setNap] = useState<number | null>(
    row?.nap_override === null || row?.nap_override === undefined ? null : Number(row.nap_override),
  );
  const [form, setForm] = useState<Form>(() => initialForm(row, age));

  const missing = [
    weight === null ? t('nutrition.missingWeight') : null,
    profile.height_cm === null ? t('nutrition.missingHeight') : null,
    age === null ? t('nutrition.missingBirth') : null,
    profile.sex === null ? t('nutrition.missingSex') : null,
    profile.activity_level === null ? t('nutrition.missingActivity') : null,
  ].filter((x) => x !== null) as string[];

  const calc: NutritionTargets | null = useMemo(() => {
    if (missing.length > 0 || !week.data || weight === null || age === null) return null;
    if (!profile.sex || !profile.activity_level || profile.height_cm === null) return null;
    return computeNutritionTargets({
      sex: profile.sex,
      weightKg: weight,
      heightCm: Number(profile.height_cm),
      age,
      activityLevel: profile.activity_level,
      goal: profile.goal,
      weeklySessions: week.data.sessions,
      napOverride: nap,
    });
  }, [missing.length, week.data, weight, age, profile, nap]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const applyCalc = () => {
    if (!calc) return;
    setForm((f) => ({
      ...f,
      kcal: calc.kcal,
      protein_g: calc.proteinG,
      carbs_g: calc.carbsG,
      fat_g: calc.fatG,
      floor_kcal: calc.floor,
    }));
    toast(t('nutrition.applied'));
  };

  const submit = async () => {
    try {
      await save.mutateAsync({
        kcal: form.kcal,
        protein_g: form.protein_g,
        carbs_g: form.carbs_g,
        fat_g: form.fat_g,
        floor_kcal: form.floor_kcal,
        weekly_rate_target: form.weekly_rate_target,
        ai_daily_limit: form.ai_daily_limit ?? 10,
        calories_enabled: form.calories_enabled,
        nap_override: nap,
        coach_note: form.coach_note.trim() || null,
      });
      toast(t('nutrition.saved'));
    } catch (e) {
      toast(toUserMessage(e));
    }
  };

  const sessions = week.data?.sessions ?? [];
  const avgMinutes = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + sessionMinutes(x), 0) / sessions.length)
    : 0;
  const macroKcal =
    form.protein_g !== null && form.carbs_g !== null && form.fat_g !== null
      ? kcalFromMacros({ proteinG: form.protein_g, carbsG: form.carbs_g, fatG: form.fat_g })
      : null;
  const pct = (f: number) =>
    `${f > 0 ? '+' : f < 0 ? '−' : ''}${formatNumber(Math.abs(f) * 100, 0)} %`;

  return (
    <VStack gap="lg">
      {/* Calcul proposé */}
      <Card>
        <VStack gap="sm">
          <Text weight="700">{t('nutrition.calcTitle')}</Text>
          <Text variant="small" color="textMuted">
            {t('nutrition.calcHelp')}
          </Text>
          <HStack gap="sm" wrap align="flex-end">
            <NumberCell
              label={t('nutrition.weightUsed')}
              showLabel
              value={weight}
              decimals={1}
              min={25}
              max={350}
              width={110}
              onCommit={setWeight}
            />
            <NumberCell
              label={t('nutrition.napUsed')}
              showLabel
              value={
                nap ?? (profile.activity_level ? NAP_BY_ACTIVITY[profile.activity_level] : null)
              }
              decimals={2}
              min={1.1}
              max={2.5}
              width={90}
              onCommit={(v) => setNap(v)}
            />
          </HStack>
          {missing.length > 0 ? (
            <Text color="warning">{t('nutrition.missing', { list: missing.join(', ') })}</Text>
          ) : calc ? (
            <VStack gap="xxs">
              <Row label={t('nutrition.stepBmr')} value={`${calc.bmr} kcal`} />
              <Row
                label={t('nutrition.stepNap', {
                  nap: formatNumber(calc.nap, 2),
                  activity: profile.activity_level
                    ? t(`enums.activity.${profile.activity_level}`)
                    : '—',
                })}
                value={`${Math.round(calc.bmr * calc.nap)} kcal`}
              />
              <Row
                label={
                  sessions.length
                    ? t('nutrition.stepTraining', { count: sessions.length, minutes: avgMinutes })
                    : t('nutrition.stepTrainingNone')
                }
                value={`+${calc.trainingKcalPerDay} kcal/j`}
              />
              <Row label={t('nutrition.stepTdee')} value={`${calc.tdee} kcal`} strong />
              {profile.goal ? (
                <Row
                  label={t('nutrition.stepGoal', {
                    goal: t(`enums.goal.${profile.goal}`),
                    percent: pct(calc.goalFactor),
                  })}
                  value={`${calc.kcal} kcal`}
                  strong
                />
              ) : null}
              <Row label={t('nutrition.stepFloor')} value={`${calc.floor} kcal`} />
              <Text variant="small" color="textMuted">
                {`${t('nutrition.protein')} ${calc.proteinG} · ${t('nutrition.carbs')} ${calc.carbsG} · ${t('nutrition.fat')} ${calc.fatG}`}
              </Text>
              <HStack>
                <Button
                  variant="secondary"
                  icon="arrow-down"
                  label={t('nutrition.useCalc')}
                  onPress={applyCalc}
                />
              </HStack>
            </VStack>
          ) : (
            <LoadingState />
          )}
        </VStack>
      </Card>

      {/* Objectifs enregistrés */}
      <Card>
        <VStack gap="md">
          <Text weight="700">{t('nutrition.targetsTitle')}</Text>
          {!row ? <Text color="textMuted">{t('nutrition.targetsNone')}</Text> : null}
          {age !== null && age < 18 ? (
            <Text color="warning">{t('nutrition.minorWarning')}</Text>
          ) : null}
          <Checkbox
            checked={form.calories_enabled}
            onChange={(v) => set('calories_enabled', v)}
            label={t('nutrition.caloriesEnabled')}
            description={t('nutrition.caloriesEnabledHint')}
          />
          <HStack gap="sm" wrap align="flex-end">
            <NumberCell
              label={t('nutrition.kcal')}
              showLabel
              value={form.kcal}
              decimals={0}
              min={800}
              max={8000}
              width={120}
              onCommit={(v) => set('kcal', v)}
            />
            <NumberCell
              label={t('nutrition.protein')}
              showLabel
              value={form.protein_g}
              decimals={0}
              max={600}
              width={110}
              onCommit={(v) => set('protein_g', v)}
            />
            <NumberCell
              label={t('nutrition.carbs')}
              showLabel
              value={form.carbs_g}
              decimals={0}
              max={1500}
              width={110}
              onCommit={(v) => set('carbs_g', v)}
            />
            <NumberCell
              label={t('nutrition.fat')}
              showLabel
              value={form.fat_g}
              decimals={0}
              max={500}
              width={110}
              onCommit={(v) => set('fat_g', v)}
            />
          </HStack>
          {macroKcal !== null ? (
            <Text
              variant="small"
              color={form.kcal && Math.abs(macroKcal - form.kcal) > 100 ? 'warning' : 'textMuted'}
            >
              {t('nutrition.macrosKcal', { kcal: macroKcal })}
            </Text>
          ) : null}
          <HStack gap="sm" wrap align="flex-end">
            <NumberCell
              label={t('nutrition.floor')}
              showLabel
              value={form.floor_kcal}
              decimals={0}
              min={800}
              max={4000}
              width={120}
              onCommit={(v) => set('floor_kcal', v)}
            />
            <NumberCell
              label={t('nutrition.weeklyRate')}
              showLabel
              value={form.weekly_rate_target}
              decimals={2}
              min={-1}
              max={1}
              width={230}
              onCommit={(v) => set('weekly_rate_target', v)}
            />
            <NumberCell
              label={t('nutrition.aiLimit')}
              showLabel
              value={form.ai_daily_limit}
              decimals={0}
              min={0}
              max={50}
              width={170}
              onCommit={(v) => set('ai_daily_limit', v)}
            />
          </HStack>
          <Text variant="caption" color="textSubtle">
            {t('nutrition.weeklyRateHint')}
          </Text>
          <TextField
            label={t('nutrition.note')}
            value={form.coach_note}
            onChangeText={(v) => set('coach_note', v)}
            multiline
          />
          <HStack>
            <Button
              icon="checkmark"
              label={t('nutrition.save')}
              loading={save.isPending}
              onPress={() => void submit()}
            />
          </HStack>
          <Text variant="caption" color="textSubtle">
            {t('nutrition.disclaimer')}
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <HStack justify="space-between" gap="md">
      <Text
        variant="small"
        color={strong ? 'text' : 'textMuted'}
        weight={strong ? '700' : '400'}
        style={{ flex: 1 }}
      >
        {label}
      </Text>
      <Text variant="small" weight={strong ? '700' : '400'} tabular>
        {value}
      </Text>
    </HStack>
  );
}
