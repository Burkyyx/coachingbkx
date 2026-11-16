import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  HStack,
  LoadingState,
  Screen,
  Text,
  VStack,
} from '@/components/ui';
import { formatRelative, isoWeekday, todayLocal, weekStart } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAdherentBundle } from '@/features/training/bundle';
import { scheduledWorkouts, suggestedWorkout } from '@/features/training/derive';
import { useActiveSession } from '@/features/training/session/store';
import { WorkoutSummaryCard } from '@/features/training/WorkoutSummaryCard';
import { supabase } from '@/lib/supabase';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { SyncBadge } from '@/offline/SyncBadge';

/** Onglet « Aujourd'hui » : séance du jour, dernier message du coach, rappel du bilan. */
export default function TodayScreen() {
  const { t } = useTranslation();
  const { profile, userId } = useAuth();
  const bundle = useAdherentBundle();
  const active = useActiveSession((s) => s.session);
  const today = todayLocal();

  // Dernier message du coach + bilan de la semaine (si en ligne).
  const extras = useQuery({
    queryKey: ['today-extras', userId, weekStart(today)],
    enabled: userId !== null,
    queryFn: async () => {
      const [msg, settings, checkin] = await Promise.all([
        supabase
          .from('messages')
          .select('body, kind, created_at, sender_id')
          .neq('sender_id', userId as string)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('app_settings').select('default_checkin_weekday').maybeSingle(),
        supabase
          .from('checkins')
          .select('id')
          .eq('adherent_id', userId as string)
          .eq('week_start', weekStart(today))
          .maybeSingle(),
      ]);
      return {
        lastMessage: msg.data,
        checkinDay: profile?.checkin_weekday ?? settings.data?.default_checkin_weekday ?? 7,
        checkinDone: checkin.data !== null,
      };
    },
  });

  if (bundle.isLoading) return <LoadingState />;
  if (bundle.isError || !bundle.data) {
    return (
      <Screen edges={['top']}>
        <ErrorState onRetry={() => void bundle.refetch()} />
      </Screen>
    );
  }

  const schedule = scheduledWorkouts(bundle.data);
  const suggestion = suggestedWorkout(schedule, today);
  const showCheckin =
    extras.data && !extras.data.checkinDone && isoWeekday(today) >= extras.data.checkinDay;

  return (
    <Screen
      edges={['top']}
      maxWidth={720}
      onRefresh={() => {
        void bundle.refetch();
        void extras.refetch();
      }}
      refreshing={bundle.isRefetching}
    >
      <HStack justify="space-between">
        <Text variant="headline" accessibilityRole="header">
          {t('training.hello', { name: profile?.first_name ?? '' })}
        </Text>
        <HStack gap="sm">
          <SyncBadge />
          <NotificationBell />
        </HStack>
      </HStack>

      {active ? (
        <Card>
          <VStack gap="sm">
            <Text weight="700">{t('training.resumeBanner', { name: active.workoutName })}</Text>
            <Button
              size="xl"
              icon="play"
              label={t('training.resume')}
              onPress={() => router.push(`/session/${active.workoutId ?? 'free'}`)}
              fullWidth
            />
          </VStack>
        </Card>
      ) : null}

      {!bundle.data.program ? (
        <EmptyState
          icon="hourglass-outline"
          title={t('training.noProgram')}
          body={t('training.noProgramBody')}
        />
      ) : suggestion ? (
        <WorkoutSummaryCard
          workout={suggestion.workout}
          bundle={bundle.data}
          title={
            suggestion.when === 'today'
              ? t('training.todayWorkout')
              : suggestion.when === 'late'
                ? t('training.lateWorkout')
                : t('training.nextWorkout')
          }
          footer={
            !active ? (
              <Button
                size="xl"
                icon="barbell"
                label={t('training.start')}
                onPress={() => router.push(`/session/${suggestion.workout.id}`)}
                fullWidth
              />
            ) : null
          }
        />
      ) : (
        <EmptyState
          icon="trophy-outline"
          title={t('training.allDone')}
          body={t('training.allDoneBody')}
        />
      )}

      {showCheckin ? (
        <Card>
          <VStack gap="sm">
            <Text weight="700">{t('training.checkinReminder')}</Text>
            <Text color="textMuted">{t('training.checkinReminderBody')}</Text>
            <Button
              variant="secondary"
              icon="clipboard-outline"
              label={t('training.fillCheckin')}
              onPress={() => router.push('/checkin')}
            />
          </VStack>
        </Card>
      ) : null}

      {extras.data?.lastMessage ? (
        <Card
          onPress={() => router.push('/messages')}
          accessibilityLabel={t('training.openMessages')}
        >
          <VStack gap="xs">
            <Text variant="small" weight="700" color="textMuted">
              {t('training.lastCoachMessage').toUpperCase()}
            </Text>
            <Text numberOfLines={3}>
              {extras.data.lastMessage.kind === 'text'
                ? extras.data.lastMessage.body
                : extras.data.lastMessage.kind === 'image'
                  ? '📷 Photo'
                  : '🎥 Vidéo'}
            </Text>
            <Text variant="caption" color="textSubtle">
              {formatRelative(extras.data.lastMessage.created_at)}
            </Text>
          </VStack>
        </Card>
      ) : null}
    </Screen>
  );
}
