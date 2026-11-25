import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  Button,
  Card,
  ErrorState,
  HStack,
  Icon,
  IconButton,
  LoadingState,
  Screen,
  Text,
  VStack,
  useFeedback,
  type IconName,
} from '@/components/ui';
import {
  addDays,
  dailyAverage,
  formatInt,
  formatLongDate,
  formatTime,
  progressOf,
  sumMacros,
  todayLocal,
  weekStart,
  type Macros,
} from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { ConsentGate } from '@/features/auth/ConsentGate';
import { useNutritionTargets } from '@/features/nutrition/api';
import { AddMealSheet, defaultMealType, mealLabel } from '@/features/nutrition/AddMealSheet';
import {
  MEAL_TYPES,
  mealTotals,
  useMealActions,
  useMealsRange,
  type Meal,
  type MealType,
} from '@/features/nutrition/journal';
import { MacroProgress, ProgressRing } from '@/features/nutrition/NutritionVisuals';
import { toUserMessage } from '@/lib/errors';
import { useSignedUrl } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: 'cafe-outline',
  lunch: 'restaurant-outline',
  snack: 'nutrition-outline',
  dinner: 'moon-outline',
};
const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Date locale de l'appareil d'un repas (même règle que le filtre de la requête). */
const dayOf = (meal: Meal) => todayLocal(new Date(meal.eaten_at));

/** Journal alimentaire de l'adhérent. */
export default function NutritionTab() {
  const { t } = useTranslation();
  return (
    <Screen maxWidth={720}>
      <VStack gap="xxs">
        <Text variant="headline" accessibilityRole="header">
          {t('nutrition.journal.title')}
        </Text>
        <Text color="textMuted">{t('nutrition.journal.subtitle')}</Text>
      </VStack>
      <ConsentGate
        type="health_data"
        title={t('nutrition.journal.consentTitle')}
        body={t('nutrition.journal.consentBody')}
      >
        <Journal />
      </ConsentGate>
      <Text variant="caption" color="textSubtle">
        {t('nutrition.disclaimer')}
      </Text>
    </Screen>
  );
}

function Journal() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { userId } = useAuth();
  const today = todayLocal();
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState<MealType | null>(null);

  const monday = weekStart(day);
  const meals = useMealsRange(userId, monday, addDays(monday, 6));
  const targets = useNutritionTargets(userId);

  if (!userId) return null;
  if (meals.isLoading || targets.isLoading) return <LoadingState />;
  if (meals.error) return <ErrorState message={toUserMessage(meals.error)} />;

  const numbers = targets.data?.calories_enabled !== false;
  const target: Macros | null =
    targets.data?.kcal != null
      ? {
          kcal: Number(targets.data.kcal),
          proteinG: Number(targets.data.protein_g ?? 0),
          carbsG: Number(targets.data.carbs_g ?? 0),
          fatG: Number(targets.data.fat_g ?? 0),
        }
      : null;

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDay = new Map<string, Meal[]>(weekDays.map((d) => [d, []]));
  for (const m of meals.data ?? []) byDay.get(dayOf(m))?.push(m);
  const dayMeals = byDay.get(day) ?? [];
  const dayTotals = sumMacros(dayMeals.map(mealTotals));
  const week = weekDays.map((d) => {
    const list = byDay.get(d) ?? [];
    return { date: d, totals: sumMacros(list.map(mealTotals)), count: list.length };
  });
  const { average, loggedDays } = dailyAverage(week);

  const dayTitle =
    day === today
      ? t('nutrition.journal.today')
      : day === addDays(today, -1)
        ? t('nutrition.journal.yesterday')
        : formatLongDate(day);

  return (
    <VStack gap="lg">
      {/* Navigation entre les jours */}
      <HStack justify="space-between">
        <IconButton
          icon="chevron-back"
          label={t('nutrition.journal.previousDay')}
          onPress={() => setDay(addDays(day, -1))}
        />
        <Text variant="title" style={{ textTransform: 'capitalize' }}>
          {dayTitle}
        </Text>
        <IconButton
          icon="chevron-forward"
          label={t('nutrition.journal.nextDay')}
          disabled={day >= today}
          style={{ opacity: day >= today ? 0.3 : 1 }}
          onPress={() => setDay(addDays(day, 1))}
        />
      </HStack>

      {/* Bande de la semaine */}
      <HStack justify="space-between">
        {week.map((d, i) => {
          const selected = d.date === day;
          const future = d.date > today;
          const p = numbers ? progressOf(d.totals.kcal, target?.kcal) : null;
          return (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: future }}
              accessibilityLabel={formatLongDate(d.date)}
              disabled={future}
              onPress={() => setDay(d.date)}
              style={{
                alignItems: 'center',
                gap: 4,
                paddingVertical: theme.spacing.xs,
                width: 40,
                borderRadius: theme.radius.md,
                backgroundColor: selected ? theme.colors.surfaceAlt : 'transparent',
                opacity: future ? 0.35 : 1,
              }}
            >
              <Text variant="caption" color="textMuted">
                {WEEKDAY_LETTERS[i]}
              </Text>
              <Text variant="small" weight={selected ? '800' : '500'}>
                {Number(d.date.slice(8, 10))}
              </Text>
              <ProgressRing
                size={22}
                stroke={4}
                progress={p ?? (d.count > 0 ? 1 : 0)}
                color={theme.colors.text}
              />
            </Pressable>
          );
        })}
      </HStack>

      {/* Résumé du jour */}
      {numbers ? (
        <Card>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.lg,
            }}
          >
            <ProgressRing
              progress={progressOf(dayTotals.kcal, target?.kcal)}
              color={theme.colors.text}
            >
              <Text variant="headline" tabular>
                {formatInt(dayTotals.kcal)}
              </Text>
              <Text variant="caption" color="textMuted">
                {target
                  ? `/ ${formatInt(target.kcal)} ${t('nutrition.journal.kcalUnit')}`
                  : t('nutrition.journal.kcalUnit')}
              </Text>
            </ProgressRing>
            <VStack gap="md" flex={1} style={{ minWidth: 220 }}>
              <Text color="textMuted">
                {!target
                  ? t('nutrition.journal.noTarget')
                  : dayTotals.kcal <= target.kcal
                    ? t('nutrition.journal.left', {
                        kcal: formatInt(target.kcal - dayTotals.kcal),
                      })
                    : t('nutrition.journal.over', {
                        kcal: formatInt(dayTotals.kcal - target.kcal),
                      })}
              </Text>
              <HStack gap="md" align="flex-start">
                <MacroProgress
                  label={t('nutrition.proteinShort')}
                  value={dayTotals.proteinG}
                  target={target?.proteinG || null}
                  color={theme.nutrition.protein}
                />
                <MacroProgress
                  label={t('nutrition.carbsShort')}
                  value={dayTotals.carbsG}
                  target={target?.carbsG || null}
                  color={theme.nutrition.carbs}
                />
                <MacroProgress
                  label={t('nutrition.fatShort')}
                  value={dayTotals.fatG}
                  target={target?.fatG || null}
                  color={theme.nutrition.fat}
                />
              </HStack>
            </VStack>
          </View>
        </Card>
      ) : (
        <Card>
          <Text color="textMuted">{t('nutrition.journal.noNumbersHint')}</Text>
        </Card>
      )}

      {targets.data?.coach_note ? (
        <Card>
          <HStack gap="sm" align="flex-start">
            <Icon name="chatbubble-ellipses-outline" color="textMuted" />
            <VStack gap="xxs" flex={1}>
              <Text variant="small" weight="700">
                {t('nutrition.journal.coachNote')}
              </Text>
              <Text>{targets.data.coach_note}</Text>
            </VStack>
          </HStack>
        </Card>
      ) : null}

      <Button
        icon="add"
        label={t('nutrition.journal.add')}
        onPress={() => setAdding(defaultMealType(day))}
      />

      {/* Repas du jour, par moment */}
      {dayMeals.length === 0 ? (
        <VStack gap="xxs" style={{ alignItems: 'center', paddingVertical: theme.spacing.md }}>
          <Icon name="restaurant-outline" size={32} color="textSubtle" />
          <Text weight="600">{t('nutrition.journal.empty')}</Text>
          <Text variant="small" color="textMuted">
            {t('nutrition.journal.emptyHint')}
          </Text>
        </VStack>
      ) : null}
      {MEAL_TYPES.map((type) => {
        const list = dayMeals.filter((m) => m.meal_type === type);
        if (list.length === 0) return null;
        const totals = sumMacros(list.map(mealTotals));
        return (
          <VStack key={type} gap="sm">
            <HStack gap="sm">
              <Icon name={MEAL_ICONS[type]} color="textMuted" size={20} />
              <Text variant="subtitle" style={{ flex: 1 }}>
                {t(`nutrition.journal.mealTypes.${type}`)}
              </Text>
              {numbers ? (
                <Text weight="700" tabular>
                  {formatInt(totals.kcal)} kcal
                </Text>
              ) : null}
              <IconButton
                icon="add"
                label={`${t('nutrition.journal.addTo')} — ${t(`nutrition.journal.mealTypes.${type}`)}`}
                onPress={() => setAdding(type)}
              />
            </HStack>
            {list.map((meal) => (
              <MealCard key={meal.id} meal={meal} numbers={numbers} adherentId={userId} />
            ))}
          </VStack>
        );
      })}

      {/* Semaine */}
      <Card>
        <VStack gap="xs">
          <Text variant="subtitle">{t('nutrition.journal.week')}</Text>
          {loggedDays === 0 ? (
            <Text color="textMuted">{t('nutrition.journal.weekNone')}</Text>
          ) : numbers ? (
            <>
              <Text>
                {t('nutrition.journal.weekAverage', {
                  kcal: formatInt(average.kcal),
                  protein: formatInt(average.proteinG),
                })}
              </Text>
              <Text variant="caption" color="textSubtle">
                {t('nutrition.journal.weekLogged', { count: loggedDays })}
              </Text>
            </>
          ) : (
            <Text color="textMuted">
              {t('nutrition.journal.daysLogged', { count: loggedDays })}
            </Text>
          )}
        </VStack>
      </Card>

      <AddMealSheet
        visible={adding !== null}
        onClose={() => setAdding(null)}
        adherentId={userId}
        day={day}
        initialType={adding ?? 'lunch'}
        numbers={numbers}
      />
    </VStack>
  );
}

function MealCard({
  meal,
  numbers,
  adherentId,
}: {
  meal: Meal;
  numbers: boolean;
  adherentId: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast, confirm } = useFeedback();
  const { remove, setFavorite } = useMealActions(adherentId);
  const totals = mealTotals(meal);
  const photo = useSignedUrl('meal-photos', meal.photo_path);
  const label = mealLabel(meal);

  const onDelete = async () => {
    const ok = await confirm({
      title: t('nutrition.journal.delete'),
      message: t('nutrition.journal.deleteConfirm'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(meal);
      toast(t('nutrition.journal.deleted'));
    } catch (e) {
      toast(toUserMessage(e));
    }
  };

  return (
    <Card>
      <VStack gap="sm">
        <HStack gap="sm" align="flex-start">
          {meal.photo_path ? (
            <Image
              source={photo.data ? { uri: photo.data } : undefined}
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceAlt,
              }}
              contentFit="cover"
              accessibilityLabel={t('nutrition.journal.modePhoto')}
            />
          ) : null}
          <VStack gap="xxs" flex={1}>
            <Text weight="600">
              {label === '—' && meal.photo_path ? t('nutrition.journal.modePhoto') : label}
            </Text>
            <Text variant="caption" color="textSubtle" tabular>
              {formatTime(meal.eaten_at)}
              {numbers
                ? ` · ${formatInt(totals.kcal)} kcal · P ${formatInt(totals.proteinG)} g · G ${formatInt(totals.carbsG)} g · L ${formatInt(totals.fatG)} g`
                : ''}
            </Text>
          </VStack>
          <IconButton
            icon={meal.is_favorite ? 'star' : 'star-outline'}
            label={
              meal.is_favorite ? t('nutrition.journal.unfavorite') : t('nutrition.journal.favorite')
            }
            onPress={() => setFavorite.mutate({ id: meal.id, favorite: !meal.is_favorite })}
          />
          <IconButton
            icon="trash-outline"
            label={t('nutrition.journal.delete')}
            onPress={() => void onDelete()}
          />
        </HStack>
        {/* Détail des aliments (inutile si le titre est déjà l'aliment unique). */}
        {meal.items.length > 1 || (meal.description && meal.items.length > 0) ? (
          <VStack gap="xxs">
            {meal.items.map((item) => (
              <HStack key={item.id} gap="sm">
                <Text variant="small" color="textMuted" style={{ flex: 1 }}>
                  {item.name}
                  {item.quantity_g !== null ? ` · ${formatInt(Number(item.quantity_g))} g` : ''}
                </Text>
                {numbers ? (
                  <Text variant="small" color="textMuted" tabular>
                    {formatInt(Number(item.kcal))} kcal
                  </Text>
                ) : null}
              </HStack>
            ))}
          </VStack>
        ) : null}
        {meal.coach_comment ? (
          <View
            style={{
              padding: theme.spacing.sm,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceAlt,
              borderLeftWidth: 3,
              borderLeftColor: theme.colors.text,
              gap: 2,
            }}
          >
            <Text variant="caption" weight="700" color="textMuted">
              {t('nutrition.journal.coachComment')}
            </Text>
            <Text variant="small">{meal.coach_comment}</Text>
          </View>
        ) : null}
      </VStack>
    </Card>
  );
}
