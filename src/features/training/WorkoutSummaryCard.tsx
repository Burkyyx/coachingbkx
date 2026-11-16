import { useTranslation } from 'react-i18next';

import { Badge, Card, HStack, Text, VStack } from '@/components/ui';
import { formatKg, formatLongDate, formatRepRange } from '@/core';

import type { AdherentBundle } from './bundle';
import type { ScheduledWorkout } from './derive';

/** Aperçu d'une séance : exercices et séries prévues. */
export function WorkoutSummaryCard({
  workout,
  bundle,
  footer,
  title,
}: {
  workout: ScheduledWorkout;
  bundle: AdherentBundle;
  footer?: React.ReactNode;
  title?: string;
}) {
  const { t } = useTranslation();
  const names = new Map(bundle.exercises.map((e) => [e.id, e.name]));
  const deload = bundle.adjustments.some((a) => a.week_index === workout.week_index);
  return (
    <Card>
      <VStack gap="md">
        {title ? (
          <Text variant="small" weight="700" color="textMuted">
            {title.toUpperCase()}
          </Text>
        ) : null}
        <VStack gap="xxs">
          <Text variant="title">{workout.name}</Text>
          <Text color="textMuted">
            {formatLongDate(workout.date)} ·{' '}
            {t('training.exercisesCount', { count: workout.exercises.length })}
          </Text>
        </VStack>
        {deload ? (
          <Badge tone="info" icon="trending-down" label={t('training.deloadWeek')} />
        ) : null}
        <VStack gap="xs">
          {workout.exercises.map((e) => {
            const working = e.sets.filter((s) => s.set_type !== 'warmup');
            const first = working[0];
            return (
              <HStack key={e.id} justify="space-between" align="flex-start">
                <Text style={{ flex: 1 }} numberOfLines={2}>
                  {e.superset_group ? `${e.superset_group} · ` : ''}
                  {names.get(e.exercise_id) ?? '—'}
                </Text>
                <Text variant="small" color="textMuted">
                  {working.length} ×{' '}
                  {formatRepRange(first?.reps_min ?? null, first?.reps_max ?? null)}
                  {first?.load_kg ? ` · ${formatKg(Number(first.load_kg))}` : ''}
                </Text>
              </HStack>
            );
          })}
        </VStack>
        {footer}
      </VStack>
    </Card>
  );
}
