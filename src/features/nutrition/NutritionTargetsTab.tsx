import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { View } from 'react-native';

import {
  Button,
  Card,
  Checkbox,
  HStack,
  Icon,
  LoadingState,
  Segmented,
  NumberCell,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  ageOn,
  computeNutritionTargets,
  formatInt,
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
import { useTheme } from '@/theme/ThemeProvider';

import {
  useNutritionTargets,
  usePlannedWeek,
  useSaveNutritionTargets,
  type NutritionTargetsRow,
} from './api';
import { CoachJournal } from './CoachJournal';
import { IconBadge, MacroBreakdown, StackedBar, StatTile } from './NutritionVisuals';

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
  const { t } = useTranslation();
  const targets = useNutritionTargets(profile.id);
  const weights = useAdherentWeights(profile.id);
  const [view, setView] = useState<'journal' | 'targets'>('journal');
  if (targets.isLoading || weights.isLoading || targets.data === undefined) return <LoadingState />;
  const last = weights.data?.at(-1)?.weight_kg;
  return (
    <VStack gap="lg">
      <Segmented
        options={[
          { value: 'journal' as const, label: t('nutrition.coach.tabJournal') },
          { value: 'targets' as const, label: t('nutrition.coach.tabTargets') },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'journal' ? (
        <CoachJournal adherentId={profile.id} targets={targets.data} />
      ) : (
        <TargetsEditor
          key={profile.id}
          profile={profile}
          row={targets.data}
          lastWeight={last === undefined ? null : Number(last)}
        />
      )}
    </VStack>
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
  const theme = useTheme();
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

  const nc = theme.nutrition;
  const activityKcal = calc ? calc.bmr * (calc.nap - 1) : 0;
  const macroField = (
    key: 'protein_g' | 'carbs_g' | 'fat_g',
    label: string,
    color: string,
    max: number,
  ) => (
    <VStack gap="xxs">
      <HStack gap="xs">
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <Text variant="small" color="textMuted">
          {label}
        </Text>
      </HStack>
      <NumberCell
        label={label}
        value={form[key]}
        decimals={0}
        max={max}
        width={110}
        onCommit={(v) => set(key, v)}
      />
    </VStack>
  );
  const macroGap = macroKcal !== null && form.kcal !== null ? macroKcal - form.kcal : null;

  return (
    <VStack gap="lg">
      {/* Calcul proposé */}
      <Card>
        <VStack gap="md">
          <HStack justify="space-between" align="flex-start" wrap gap="md">
            <VStack gap="xxs" flex={1}>
              <HStack gap="sm">
                <IconBadge icon="calculator-outline" color={nc.bmr} size={32} />
                <Text variant="subtitle">{t('nutrition.calcTitle')}</Text>
              </HStack>
              <Text variant="small" color="textMuted">
                {t('nutrition.calcHelp')}
              </Text>
            </VStack>
            <HStack gap="sm" align="flex-end">
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
          </HStack>

          {missing.length > 0 ? (
            <HStack gap="sm" align="flex-start">
              <Icon name="alert-circle-outline" color="warning" />
              <Text color="warning" style={{ flex: 1 }}>
                {t('nutrition.missing', { list: missing.join(', ') })}
              </Text>
            </HStack>
          ) : !calc ? (
            <LoadingState />
          ) : (
            <VStack gap="lg">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                <StatTile
                  icon="flame-outline"
                  color={nc.bmr}
                  label={t('nutrition.statBmr')}
                  value={formatInt(calc.bmr)}
                  unit="kcal"
                  caption={t('nutrition.statBmrCaption')}
                />
                <StatTile
                  icon="flash-outline"
                  color={nc.activity}
                  label={t('nutrition.statTdee')}
                  value={formatInt(calc.tdee)}
                  unit="kcal"
                  caption={t('nutrition.statTdeeCaption')}
                />
                <StatTile
                  icon="flag-outline"
                  color={nc.training}
                  emphasis
                  label={t('nutrition.statTarget')}
                  value={formatInt(calc.kcal)}
                  unit="kcal"
                  caption={`${profile.goal ? `${t(`enums.goal.${profile.goal}`)} · ${pct(calc.goalFactor)}` : t('nutrition.noGoal')} · ${t('nutrition.floorShort', { kcal: formatInt(calc.floor) })}`}
                />
              </View>

              <VStack gap="sm">
                <Text weight="700">{t('nutrition.breakdownTitle')}</Text>
                <StackedBar
                  unit="kcal"
                  segments={[
                    {
                      key: 'bmr',
                      icon: 'flame-outline',
                      color: nc.bmr,
                      label: t('nutrition.segBmr'),
                      detail: t('nutrition.segBmrDetail'),
                      value: calc.bmr,
                    },
                    {
                      key: 'activity',
                      icon: 'walk-outline',
                      color: nc.activity,
                      label: t('nutrition.segActivity'),
                      detail: t('nutrition.segActivityDetail', {
                        nap: formatNumber(calc.nap, 2),
                        activity: profile.activity_level
                          ? t(`enums.activity.${profile.activity_level}`)
                          : '—',
                      }),
                      value: activityKcal,
                    },
                    {
                      key: 'training',
                      icon: 'barbell-outline',
                      color: nc.training,
                      label: t('nutrition.segTraining'),
                      detail: sessions.length
                        ? t('nutrition.segTrainingDetail', {
                            count: sessions.length,
                            minutes: avgMinutes,
                          })
                        : t('nutrition.segTrainingNone'),
                      value: calc.trainingKcalPerDay,
                    },
                  ]}
                />
              </VStack>

              <VStack gap="sm">
                <Text weight="700">{t('nutrition.macrosTitle')}</Text>
                <MacroBreakdown
                  proteinG={calc.proteinG}
                  carbsG={calc.carbsG}
                  fatG={calc.fatG}
                  weightKg={weight}
                />
              </VStack>

              <HStack>
                <Button icon="arrow-down" label={t('nutrition.useCalc')} onPress={applyCalc} />
              </HStack>
            </VStack>
          )}
        </VStack>
      </Card>

      {/* Objectifs enregistrés */}
      <Card>
        <VStack gap="md">
          <HStack gap="sm">
            <IconBadge icon="flag-outline" color={nc.training} size={32} />
            <Text variant="subtitle" style={{ flex: 1 }}>
              {t('nutrition.targetsTitle')}
            </Text>
          </HStack>
          {!row ? <Text color="textMuted">{t('nutrition.targetsNone')}</Text> : null}
          {age !== null && age < 18 ? (
            <HStack gap="sm">
              <Icon name="information-circle-outline" color="warning" />
              <Text color="warning">{t('nutrition.minorWarning')}</Text>
            </HStack>
          ) : null}
          <Checkbox
            checked={form.calories_enabled}
            onChange={(v) => set('calories_enabled', v)}
            label={t('nutrition.caloriesEnabled')}
            description={t('nutrition.caloriesEnabledHint')}
          />
          <HStack gap="md" wrap align="flex-end">
            <VStack gap="xxs">
              <HStack gap="xs">
                <Icon name="flame" size={14} rawColor={nc.training} />
                <Text variant="small" color="textMuted">
                  {t('nutrition.kcal')}
                </Text>
              </HStack>
              <NumberCell
                label={t('nutrition.kcal')}
                value={form.kcal}
                decimals={0}
                min={800}
                max={8000}
                width={130}
                onCommit={(v) => set('kcal', v)}
              />
            </VStack>
            {macroField('protein_g', t('nutrition.protein'), nc.protein, 600)}
            {macroField('carbs_g', t('nutrition.carbs'), nc.carbs, 1500)}
            {macroField('fat_g', t('nutrition.fat'), nc.fat, 500)}
          </HStack>
          {form.protein_g !== null && form.carbs_g !== null && form.fat_g !== null ? (
            <MacroBreakdown
              compact
              proteinG={form.protein_g}
              carbsG={form.carbs_g}
              fatG={form.fat_g}
              weightKg={weight}
            />
          ) : null}
          {macroGap !== null ? (
            <HStack gap="xs">
              <Icon
                name={Math.abs(macroGap) <= 100 ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={Math.abs(macroGap) <= 100 ? 'success' : 'warning'}
              />
              <Text variant="small" color={Math.abs(macroGap) <= 100 ? 'success' : 'warning'}>
                {t('nutrition.macrosKcal', { kcal: formatInt(macroKcal ?? 0) })}
              </Text>
            </HStack>
          ) : null}

          <View style={{ height: 1, backgroundColor: theme.colors.border }} />
          <HStack gap="sm">
            <Icon name="options-outline" color="textMuted" size={18} />
            <Text weight="700">{t('nutrition.settingsTitle')}</Text>
          </HStack>
          <HStack gap="sm" wrap align="flex-end">
            <NumberCell
              label={t('nutrition.floor')}
              showLabel
              value={form.floor_kcal}
              decimals={0}
              min={800}
              max={4000}
              width={130}
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
