import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  HStack,
  LoadingState,
  SectionHeader,
  StatTile,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  addDays,
  dailyAverage,
  formatInt,
  formatLongDate,
  formatNumber,
  formatSigned,
  formatTime,
  observedWeeklyRate,
  sumMacros,
  todayLocal,
} from '@/core';
import { useAdherentWeights } from '@/features/coach/adherent';
import { toUserMessage } from '@/lib/errors';
import { useSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';

import type { NutritionTargetsRow } from './api';
import { mealLabel } from './AddMealSheet';
import { MEAL_TYPES, mealTotals, useMealsRange, type Meal } from './journal';

const PAGE_DAYS = 14;
const dayOf = (meal: Meal) => todayLocal(new Date(meal.eaten_at));

/** Consommation des analyses photo par IA (ce mois-ci et aujourd'hui). */
function useAiUsage(adherentId: string) {
  return useQuery({
    queryKey: ['nutrition', 'ai-usage', adherentId],
    queryFn: async () => {
      const today = todayLocal();
      const monthStart = `${today.slice(0, 7)}-01`;
      const { data, error } = await supabase
        .from('ai_usage')
        .select('created_at, status, cost_usd')
        .eq('adherent_id', adherentId)
        .gte('created_at', new Date(`${monthStart}T00:00:00`).toISOString());
      if (error) throw error;
      const counted = (data ?? []).filter((u) => u.status !== 'error');
      return {
        month: counted.length,
        today: counted.filter((u) => todayLocal(new Date(u.created_at)) === today).length,
        costUsd: (data ?? []).reduce((s, u) => s + Number(u.cost_usd), 0),
      };
    },
  });
}

/** Journal alimentaire de l'adhérent, vu par le coach (régularité, moyennes, commentaires). */
export function CoachJournal({
  adherentId,
  targets,
}: {
  adherentId: string;
  targets: NutritionTargetsRow | null;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const today = todayLocal();
  const [days, setDays] = useState(PAGE_DAYS);
  const from = addDays(today, -Math.max(days, 30) + 1);
  const meals = useMealsRange(adherentId, from, today);
  const usage = useAiUsage(adherentId);
  const weights = useAdherentWeights(adherentId);

  if (meals.isLoading) return <LoadingState />;

  const byDay = new Map<string, Meal[]>();
  for (const m of meals.data ?? []) {
    const d = dayOf(m);
    byDay.set(d, [...(byDay.get(d) ?? []), m]);
  }
  const lastDays = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -i));
  const logged7 = lastDays(7).filter((d) => byDay.has(d)).length;
  const logged30 = lastDays(30).filter((d) => byDay.has(d)).length;
  const week = lastDays(7).map((d) => {
    const list = byDay.get(d) ?? [];
    return { date: d, totals: sumMacros(list.map(mealTotals)), count: list.length };
  });
  const { average, loggedDays } = dailyAverage(week);
  const rate = observedWeeklyRate(
    (weights.data ?? []).map((w) => ({ date: w.measured_on, kg: Number(w.weight_kg) })),
    today,
  );
  const target = targets?.kcal ?? null;
  const numbers = targets?.calories_enabled !== false;

  return (
    <VStack gap="lg">
      {/* Chiffres clés */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <StatTile
          icon="calendar"
          color={theme.accent.checkins}
          label={t('nutrition.coach.regularity')}
          value={`${logged7}/7`}
          unit={t('nutrition.coach.days')}
          caption={t('nutrition.coach.regularity30', { count: logged30 })}
          emphasis
        />
        {numbers ? (
          <StatTile
            icon="flame"
            color={theme.accent.training}
            label={t('nutrition.coach.average7')}
            value={loggedDays ? formatInt(average.kcal) : '—'}
            unit="kcal"
            caption={
              loggedDays
                ? t('nutrition.coach.averageCaption', {
                    protein: formatInt(average.proteinG),
                    target: target ? formatInt(target) : '—',
                  })
                : t('nutrition.coach.noData')
            }
            emphasis
          />
        ) : null}
        <StatTile
          icon="scale"
          color={theme.accent.progress}
          label={t('nutrition.coach.weightRate')}
          value={rate === null ? '—' : formatSigned(rate, 2)}
          unit={rate === null ? undefined : '%/sem.'}
          caption={
            rate === null
              ? t('nutrition.coach.weightRateMissing')
              : t('nutrition.coach.weightRateHelp')
          }
          emphasis
        />
        <StatTile
          icon="sparkles"
          color={theme.accent.suggestions}
          label={t('nutrition.coach.aiUsage')}
          value={String(usage.data?.month ?? 0)}
          unit={t('nutrition.coach.thisMonth')}
          caption={t('nutrition.coach.aiCaption', {
            today: usage.data?.today ?? 0,
            limit: targets?.ai_daily_limit ?? 10,
            cost: formatNumber(usage.data?.costUsd ?? 0, 3),
          })}
          emphasis
        />
      </View>

      {/* Régularité des 14 derniers jours */}
      <HStack gap="xs" wrap>
        {lastDays(14)
          .reverse()
          .map((d) => (
            <View
              key={d}
              accessibilityLabel={`${formatLongDate(d)} : ${byDay.has(d) ? t('nutrition.coach.logged') : t('nutrition.coach.notLogged')}`}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                backgroundColor: byDay.has(d) ? theme.accent.nutrition : theme.colors.surfaceAlt,
                borderWidth: 1,
                borderColor: byDay.has(d) ? theme.accent.nutrition : theme.colors.border,
              }}
            />
          ))}
        <Text variant="caption" color="textSubtle">
          {t('nutrition.coach.last14')}
        </Text>
      </HStack>

      {/* Jours */}
      {lastDays(days).every((d) => !byDay.has(d)) ? (
        <EmptyState icon="restaurant-outline" title={t('nutrition.coach.empty')} />
      ) : null}
      {lastDays(days)
        .filter((d) => byDay.has(d))
        .map((d) => {
          const list = byDay.get(d) ?? [];
          const totals = sumMacros(list.map(mealTotals));
          return (
            <VStack key={d} gap="sm">
              <SectionHeader
                title={formatLongDate(d)}
                icon="restaurant"
                accent={theme.accent.nutrition}
                right={
                  numbers ? (
                    <Text weight="700" tabular>
                      {formatInt(totals.kcal)}
                      {target ? ` / ${formatInt(target)}` : ''} kcal · P{' '}
                      {formatInt(totals.proteinG)} g
                    </Text>
                  ) : null
                }
              />
              {MEAL_TYPES.flatMap((type) => list.filter((m) => m.meal_type === type)).map(
                (meal) => (
                  <CoachMealCard key={meal.id} meal={meal} numbers={numbers} />
                ),
              )}
            </VStack>
          );
        })}
      {days < 60 ? (
        <Button
          variant="ghost"
          icon="chevron-down"
          label={t('nutrition.coach.showMore')}
          onPress={() => setDays((n) => n + PAGE_DAYS)}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
    </VStack>
  );
}

function CoachMealCard({ meal, numbers }: { meal: Meal; numbers: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  const photo = useSignedUrl('meal-photos', meal.photo_path);
  const [big, setBig] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const totals = mealTotals(meal);

  const save = useMutation({
    mutationFn: async (comment: string | null) => {
      const { error } = await supabase
        .from('meals')
        .update({ coach_comment: comment })
        .eq('id', meal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(null);
      toast(t('nutrition.coach.commentSaved'));
      void qc.invalidateQueries({ queryKey: ['nutrition', 'meals', meal.adherent_id] });
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  const label = mealLabel(meal);
  return (
    <Card>
      <VStack gap="sm">
        <HStack gap="md" align="flex-start">
          {meal.photo_path ? (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel={t('nutrition.coach.enlargePhoto')}
              onPress={() => setBig((b) => !b)}
            >
              <Image
                source={photo.data ? { uri: photo.data } : undefined}
                style={{
                  width: big ? 260 : 72,
                  height: big ? 200 : 72,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
                contentFit="cover"
              />
            </Pressable>
          ) : null}
          <VStack gap="xxs" flex={1}>
            <Text weight="600">
              {label === '—' && meal.photo_path ? t('nutrition.journal.modePhoto') : label}
            </Text>
            <Text variant="caption" color="textSubtle" tabular>
              {t(`nutrition.journal.mealTypes.${meal.meal_type}`)} · {formatTime(meal.eaten_at)}
              {numbers
                ? ` · ${formatInt(totals.kcal)} kcal · P ${formatInt(totals.proteinG)} g · G ${formatInt(totals.carbsG)} g · L ${formatInt(totals.fatG)} g`
                : ''}
            </Text>
            <Text variant="caption" color="textSubtle">
              {t(`nutrition.coach.sources.${meal.source}`)}
              {meal.analysis_note ? ` · ${meal.analysis_note}` : ''}
            </Text>
            {meal.items.length > 1 || (meal.description && meal.items.length > 0)
              ? meal.items.map((i) => (
                  <Text key={i.id} variant="small" color="textMuted">
                    {i.name}
                    {i.quantity_g !== null ? ` · ${formatInt(Number(i.quantity_g))} g` : ''}
                    {numbers ? ` · ${formatInt(Number(i.kcal))} kcal` : ''}
                  </Text>
                ))
              : null}
          </VStack>
        </HStack>

        {draft === null ? (
          meal.coach_comment ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.coach.editComment')}
              onPress={() => setDraft(meal.coach_comment ?? '')}
              style={{
                padding: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: `${theme.accent.messages}1A`,
                borderLeftWidth: 3,
                borderLeftColor: theme.accent.messages,
              }}
            >
              <Text variant="small">{meal.coach_comment}</Text>
            </Pressable>
          ) : (
            <Button
              variant="ghost"
              icon="chatbubble-ellipses-outline"
              label={t('nutrition.coach.addComment')}
              onPress={() => setDraft('')}
              style={{ alignSelf: 'flex-start' }}
            />
          )
        ) : (
          <VStack gap="xs">
            <TextField
              label={t('nutrition.coach.comment')}
              placeholder={t('nutrition.coach.commentPlaceholder')}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={1000}
            />
            <HStack gap="xs" wrap>
              <Button
                icon="send"
                label={t('nutrition.coach.send')}
                loading={save.isPending}
                disabled={!draft.trim()}
                onPress={() => save.mutate(draft.trim())}
              />
              {meal.coach_comment ? (
                <Button
                  variant="ghost"
                  icon="trash-outline"
                  label={t('nutrition.coach.deleteComment')}
                  onPress={() => save.mutate(null)}
                />
              ) : null}
              <Button variant="ghost" label={t('common.cancel')} onPress={() => setDraft(null)} />
            </HStack>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
