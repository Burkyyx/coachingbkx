import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  HStack,
  IconBadge,
  LoadingState,
  Screen,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatRelative, isoWeekday, todayLocal, weekStart } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { CommunityPrompt } from '@/features/community/CommunityPrompt';
import { useAdherentBundle } from '@/features/training/bundle';
import { scheduledWorkouts, suggestedWorkout } from '@/features/training/derive';
import { sessionActions, useActiveSession } from '@/features/training/session/store';
import { WorkoutSummaryCard } from '@/features/training/WorkoutSummaryCard';
import { supabase } from '@/lib/supabase';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { SyncBadge } from '@/offline/SyncBadge';
import { useTheme } from '@/theme/ThemeProvider';

/** Onglet « Aujourd'hui » : séance du jour, dernier message du coach, rappel du bilan. */
export default function TodayScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { confirm } = useFeedback();
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
        <Card accent={theme.accent.training}>
          <VStack gap="sm">
            <HStack gap="sm">
              <IconBadge icon="play" color={theme.accent.training} size={30} />
              <Text weight="700" style={{ flex: 1 }}>
                {t('training.resumeBanner', { name: active.workoutName })}
              </Text>
            </HStack>
            <Button
              size="xl"
              icon="play"
              label={t('training.resume')}
              onPress={() => router.push(`/session/${active.workoutId ?? 'free'}`)}
              fullWidth
            />
            <Button
              variant="ghost"
              icon="close"
              label={t('training.abandon')}
              onPress={() =>
                void confirm({
                  title: t('training.abandon'),
                  message: t('training.abandonConfirm'),
                  confirmLabel: t('training.abandon'),
                  destructive: true,
                }).then((ok) => (ok ? sessionActions.abandon() : undefined))
              }
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
            active ? null : suggestion.workout.exercises.length === 0 ? (
              <Text color="textMuted">{t('training.emptyWorkoutBody')}</Text>
            ) : (
              <Button
                size="xl"
                icon="barbell"
                label={t('training.start')}
                onPress={() => router.push(`/session/${suggestion.workout.id}`)}
                fullWidth
              />
            )
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
        <Card accent={theme.accent.checkins}>
          <VStack gap="sm">
            <HStack gap="sm">
              <IconBadge icon="clipboard-outline" color={theme.accent.checkins} size={30} />
              <Text weight="700" style={{ flex: 1 }}>
                {t('training.checkinReminder')}
              </Text>
            </HStack>
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
          accent={theme.accent.messages}
        >
          <VStack gap="xs">
            <HStack gap="sm">
              <IconBadge icon="chatbubble-ellipses" color={theme.accent.messages} size={28} />
              <Text variant="small" weight="700" style={{ color: theme.accent.messages }}>
                {t('training.lastCoachMessage').toUpperCase()}
              </Text>
            </HStack>
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
      <CommunityPrompt />
    </Screen>
  );
}
