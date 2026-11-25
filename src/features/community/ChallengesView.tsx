import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  IconBadge,
  LoadingState,
  Sheet,
  Text,
  VStack,
  useFeedback,
  type IconName,
} from '@/components/ui';
import { challengeProgress, formatFrenchDate, formatInt, formatNumber, todayLocal } from '@/core';
import { toUserMessage } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

import { useChallengeActions, useChallengeBoard, useChallenges, type Challenge } from './progress';

const METRIC_ICONS: Record<Challenge['metric'], IconName> = {
  sessions: 'barbell',
  streak_weeks: 'flame',
  volume: 'layers',
  reps: 'repeat',
};

export function challengeStatus(c: Challenge): 'upcoming' | 'active' | 'ended' {
  const today = todayLocal();
  if (c.starts_on > today) return 'upcoming';
  if (c.ends_on < today) return 'ended';
  return 'active';
}

/** « 12 séances », « 10 000 kg soulevés · Squat »… */
export function useChallengeGoal() {
  const { t } = useTranslation();
  return (c: Pick<Challenge, 'metric' | 'target' | 'exercise'>, value?: number) => {
    const n = value ?? Number(c.target);
    const text = t(`community.challenges.metric.${c.metric}`, {
      count: Math.round(n),
      value: formatInt(n),
    });
    return c.exercise ? `${text} · ${c.exercise.name}` : text;
  };
}

/** Carte d'un challenge (adhérent et coach). */
export function ChallengeCard({
  c,
  joined,
  myProgress,
  completed,
  participants,
  collectiveTotal,
  actions,
  onOpen,
}: {
  c: Challenge;
  joined: boolean;
  myProgress: number;
  completed: boolean;
  participants: number;
  collectiveTotal: number;
  actions?: ReactNode;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const goal = useChallengeGoal();
  const status = challengeStatus(c);
  const shown = c.collective ? collectiveTotal : myProgress;
  const ratio = challengeProgress(shown, Number(c.target));
  const color = completed ? theme.colors.success : theme.accent.suggestions;

  return (
    <Card accent={color}>
      <VStack gap="sm">
        <HStack gap="sm" align="flex-start">
          <IconBadge icon={METRIC_ICONS[c.metric]} color={color} size={40} />
          <VStack gap="xxs" flex={1}>
            <Text weight="700">{c.title}</Text>
            <Text variant="small" color="textMuted">
              {goal(c)}
              {c.collective ? ` · ${t('community.challenges.collective')}` : ''}
            </Text>
            <Text variant="caption" color="textSubtle">
              {t('community.challenges.dates', {
                from: formatFrenchDate(c.starts_on),
                to: formatFrenchDate(c.ends_on),
              })}{' '}
              · {t('community.challenges.participants', { count: participants })}
            </Text>
          </VStack>
          <Badge
            tone={
              completed
                ? 'success'
                : status === 'active'
                  ? 'info'
                  : status === 'upcoming'
                    ? 'neutral'
                    : 'neutral'
            }
            label={
              completed
                ? t('community.challenges.done')
                : t(`community.challenges.status.${status}`)
            }
          />
        </HStack>
        {c.description ? <Text variant="small">{c.description}</Text> : null}
        {joined || c.collective ? (
          <VStack gap="xxs">
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.colors.surfaceAlt,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${ratio * 100}%`,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: color,
                }}
              />
            </View>
            <Text variant="caption" color="textMuted" tabular>
              {c.collective
                ? t('community.challenges.collectiveProgress', {
                    value: formatNumber(shown, 0),
                    target: formatNumber(Number(c.target), 0),
                  })
                : t('community.challenges.myProgress', {
                    value: formatNumber(shown, 0),
                    target: formatNumber(Number(c.target), 0),
                  })}
            </Text>
          </VStack>
        ) : null}
        <HStack gap="sm" wrap>
          <Text variant="caption" weight="700" style={{ color: theme.accent.records }}>
            +{c.xp_reward} XP
          </Text>
          {c.real_reward ? (
            <Text variant="caption" weight="700" style={{ color: theme.accent.suggestions }}>
              🎁 {c.real_reward}
            </Text>
          ) : null}
          {c.leaderboard ? (
            <Text variant="caption" color="textSubtle">
              {t('community.challenges.withBoard')}
            </Text>
          ) : null}
        </HStack>
        <HStack gap="xs" wrap>
          {actions}
          {onOpen ? (
            <Button
              variant="ghost"
              icon="podium-outline"
              label={
                c.leaderboard
                  ? t('community.challenges.openBoard')
                  : t('community.challenges.openProgress')
              }
              onPress={onOpen}
            />
          ) : null}
        </HStack>
      </VStack>
    </Card>
  );
}

/** Challenges côté adhérent : rejoindre, suivre sa progression, voir le classement. */
export function ChallengesView({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const data = useChallenges(uid);
  const actions = useChallengeActions(uid);
  const [board, setBoard] = useState<Challenge | null>(null);

  if (data.isLoading || !data.data) return <LoadingState />;
  const list = data.data.challenges.filter(
    (c) => challengeStatus(c) !== 'ended' || data.data.mine.has(c.id),
  );
  if (list.length === 0)
    return <EmptyState icon="flag-outline" title={t('community.challenges.empty')} />;

  return (
    <VStack gap="md">
      {list.map((c) => {
        const mine = data.data.mine.get(c.id);
        const counts = data.data.counts.get(c.id);
        const status = challengeStatus(c);
        return (
          <ChallengeCard
            key={c.id}
            c={c}
            joined={!!mine}
            myProgress={Number(mine?.progress ?? 0)}
            completed={!!mine?.completed_at}
            participants={counts?.participants ?? 0}
            collectiveTotal={counts?.total ?? 0}
            onOpen={() => setBoard(c)}
            actions={
              status === 'ended' ? null : mine ? (
                mine.completed_at ? null : (
                  <Button
                    variant="ghost"
                    icon="exit-outline"
                    label={t('community.challenges.leave')}
                    onPress={() =>
                      actions.leave.mutate(c.id, { onError: (e) => toast(toUserMessage(e)) })
                    }
                  />
                )
              ) : (
                <Button
                  icon="flag"
                  label={t('community.challenges.join')}
                  loading={actions.join.isPending}
                  onPress={() =>
                    actions.join.mutate(c.id, {
                      onSuccess: () => toast(t('community.challenges.joined')),
                      onError: (e) => toast(toUserMessage(e)),
                    })
                  }
                  style={{ alignSelf: 'flex-start' }}
                />
              )
            }
          />
        );
      })}
      {board ? <BoardSheet challenge={board} onClose={() => setBoard(null)} /> : null}
    </VStack>
  );
}

/** Progression des participants (classement si activé, sinon soi-même). */
export function BoardSheet({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const board = useChallengeBoard(challenge.id);
  const target = Number(challenge.target);
  return (
    <Sheet visible onClose={onClose} title={challenge.title}>
      {board.isLoading ? <LoadingState /> : null}
      {!challenge.leaderboard ? (
        <Text variant="small" color="textMuted">
          {t('community.challenges.noBoard')}
        </Text>
      ) : null}
      {(board.data ?? []).length === 0 && !board.isLoading ? (
        <Text color="textMuted">{t('community.challenges.noParticipants')}</Text>
      ) : null}
      {(board.data ?? []).map((r, i) => (
        <HStack key={r.adherent_id} gap="sm">
          <Text weight="700" tabular style={{ width: 24 }}>
            {challenge.leaderboard ? `${i + 1}.` : ''}
          </Text>
          <Avatar id={r.adherent_id} name={r.display_name} size={30} />
          <VStack gap="xxs" flex={1}>
            <Text weight={r.is_me ? '700' : '500'}>
              {r.display_name}
              {r.completed ? ' ✅' : ''}
            </Text>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.colors.surfaceAlt,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${challengeProgress(r.progress, target) * 100}%`,
                  height: 6,
                  backgroundColor: theme.accent.suggestions,
                }}
              />
            </View>
          </VStack>
          <Text variant="small" tabular color="textMuted">
            {formatNumber(r.progress, 0)} / {formatNumber(target, 0)}
          </Text>
        </HStack>
      ))}
    </Sheet>
  );
}
