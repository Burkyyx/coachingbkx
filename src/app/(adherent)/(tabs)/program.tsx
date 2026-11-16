import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  HStack,
  Icon,
  LoadingState,
  Screen,
  Segmented,
  Sheet,
  Text,
  VStack,
} from '@/components/ui';
import { formatLongDate, programWeekIndex, todayLocal } from '@/core';
import { useAdherentBundle } from '@/features/training/bundle';
import { scheduledWorkouts, type ScheduledWorkout } from '@/features/training/derive';
import { useActiveSession } from '@/features/training/session/store';
import { WorkoutSummaryCard } from '@/features/training/WorkoutSummaryCard';
import { SyncBadge } from '@/offline/SyncBadge';

/** Onglet « Programme » : semaine par semaine, séances faites / à faire. */
export default function ProgramScreen() {
  const { t } = useTranslation();
  const bundle = useAdherentBundle();
  const active = useActiveSession((s) => s.session);
  const today = todayLocal();
  const [week, setWeek] = useState<number | null>(null);
  const [detail, setDetail] = useState<ScheduledWorkout | null>(null);

  if (bundle.isLoading) return <LoadingState />;
  if (bundle.isError || !bundle.data) {
    return (
      <Screen edges={['top']}>
        <ErrorState onRetry={() => void bundle.refetch()} />
      </Screen>
    );
  }
  const program = bundle.data.program;
  if (!program?.start_date) {
    return (
      <Screen edges={['top']}>
        <Text variant="headline">{t('training.programTitle')}</Text>
        <EmptyState
          icon="hourglass-outline"
          title={t('training.noProgram')}
          body={t('training.noProgramBody')}
        />
      </Screen>
    );
  }

  const schedule = scheduledWorkouts(bundle.data);
  const currentWeek = Math.min(
    Math.max(1, programWeekIndex(program.start_date, today)),
    program.duration_weeks,
  );
  const shownWeek = week ?? currentWeek;
  const items = schedule.filter((w) => w.week_index === shownWeek);
  const deload = bundle.data.adjustments.some((a) => a.week_index === shownWeek);

  return (
    <Screen
      edges={['top']}
      maxWidth={720}
      onRefresh={() => void bundle.refetch()}
      refreshing={bundle.isRefetching}
    >
      <HStack justify="space-between">
        <VStack gap="xxs" flex={1}>
          <Text variant="headline" accessibilityRole="header">
            {t('training.programTitle')}
          </Text>
          <Text color="textMuted">{program.name}</Text>
        </VStack>
        <SyncBadge />
      </HStack>
      <Segmented
        scrollable
        options={Array.from({ length: program.duration_weeks }, (_, i) => ({
          value: i + 1,
          label: t('training.weekShort', { n: i + 1 }),
        }))}
        value={shownWeek}
        onChange={setWeek}
      />
      {deload ? <Badge tone="info" icon="trending-down" label={t('training.deloadWeek')} /> : null}
      {items.length === 0 ? (
        <EmptyState icon="calendar-outline" title={t('programs.emptyWeek')} />
      ) : null}
      {items.map((w) => {
        const status = w.done ? 'done' : w.date < today ? 'missed' : 'todo';
        return (
          <Card
            key={w.id}
            onPress={() => setDetail(w)}
            accessibilityLabel={`${w.name}, ${formatLongDate(w.date)}`}
          >
            <HStack gap="md">
              <Icon
                name={
                  status === 'done'
                    ? 'checkmark-circle'
                    : status === 'missed'
                      ? 'alert-circle-outline'
                      : 'ellipse-outline'
                }
                color={
                  status === 'done' ? 'success' : status === 'missed' ? 'warning' : 'textSubtle'
                }
                size={28}
              />
              <VStack gap="xxs" flex={1}>
                <Text weight="700">{w.name}</Text>
                <Text variant="small" color="textMuted">
                  {formatLongDate(w.date)} ·{' '}
                  {t('training.exercisesCount', { count: w.exercises.length })}
                </Text>
              </VStack>
              <Badge
                label={
                  status === 'done'
                    ? t('training.done')
                    : status === 'missed'
                      ? t('training.missed')
                      : t('training.toDo')
                }
                tone={status === 'done' ? 'success' : status === 'missed' ? 'warning' : 'neutral'}
              />
            </HStack>
          </Card>
        );
      })}
      <Sheet visible={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail ? (
          <WorkoutSummaryCard
            workout={detail}
            bundle={bundle.data}
            footer={
              !detail.done && !active ? (
                <Button
                  size="lg"
                  icon="barbell"
                  label={t('training.start')}
                  onPress={() => {
                    setDetail(null);
                    router.push(`/session/${detail.id}`);
                  }}
                  fullWidth
                />
              ) : null
            }
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
