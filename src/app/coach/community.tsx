import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  IconButton,
  LoadingState,
  NumberCell,
  Screen,
  Segmented,
  SectionHeader,
  Sheet,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatRelative, type XpRules } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCommunityPeople, useFeed, type Post } from '@/features/community/api';
import { ChallengeEditor } from '@/features/community/ChallengeEditor';
import { BoardSheet, ChallengeCard } from '@/features/community/ChallengesView';
import { Composer } from '@/features/community/Composer';
import {
  useBannedWords,
  useMembers,
  useModeration,
  useReports,
} from '@/features/community/moderation';
import { PostCard } from '@/features/community/PostCard';
import {
  useChallengeActions,
  useChallenges,
  useSaveXpRules,
  useXpRules,
  type Challenge,
} from '@/features/community/progress';
import { toUserMessage } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'challenges' | 'feed' | 'reports' | 'settings';

/** Espace coach : challenges, fil (modération), signalements, réglages. */
export default function CoachCommunityScreen() {
  const { t } = useTranslation();
  const reports = useReports();
  const [tab, setTab] = useState<Tab>('challenges');
  const pending = reports.data?.length ?? 0;
  return (
    <Screen maxWidth={900}>
      <VStack gap="xxs">
        <Text variant="headline" accessibilityRole="header">
          {t('community.title')}
        </Text>
        <Text color="textMuted">{t('community.coach.subtitle')}</Text>
      </VStack>
      <Segmented
        scrollable
        options={[
          { value: 'challenges' as const, label: t('community.tabChallenges') },
          { value: 'feed' as const, label: t('community.tabFeed') },
          {
            value: 'reports' as const,
            label:
              pending > 0
                ? `${t('community.coach.reports')} (${pending})`
                : t('community.coach.reports'),
          },
          { value: 'settings' as const, label: t('community.coach.settings') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'challenges' ? <CoachChallenges /> : null}
      {tab === 'feed' ? <CoachFeed /> : null}
      {tab === 'reports' ? <Reports /> : null}
      {tab === 'settings' ? <CommunitySettings /> : null}
    </Screen>
  );
}

function CoachChallenges() {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const data = useChallenges(null);
  const { remove } = useChallengeActions(null);
  const [editing, setEditing] = useState<Challenge | 'new' | null>(null);
  const [board, setBoard] = useState<Challenge | null>(null);

  return (
    <VStack gap="md">
      <Button
        icon="add"
        label={t('community.coach.newChallenge')}
        onPress={() => setEditing('new')}
        style={{ alignSelf: 'flex-start' }}
      />
      {data.isLoading ? <LoadingState /> : null}
      {data.data && data.data.challenges.length === 0 ? (
        <EmptyState icon="flag-outline" title={t('community.coach.noChallenges')} />
      ) : null}
      {(data.data?.challenges ?? []).map((c) => {
        const counts = data.data?.counts.get(c.id);
        return (
          <ChallengeCard
            key={c.id}
            c={c}
            joined={false}
            myProgress={0}
            completed={false}
            participants={counts?.participants ?? 0}
            collectiveTotal={counts?.total ?? 0}
            onOpen={() => setBoard(c)}
            actions={
              <>
                <Button
                  variant="secondary"
                  icon="create-outline"
                  label={t('common.edit')}
                  onPress={() => setEditing(c)}
                />
                <Button
                  variant="ghost"
                  icon="trash-outline"
                  label={t('common.delete')}
                  onPress={async () => {
                    const ok = await confirm({
                      title: t('community.coach.deleteChallenge'),
                      message: t('community.coach.deleteChallengeConfirm', { title: c.title }),
                      confirmLabel: t('common.delete'),
                      destructive: true,
                    });
                    if (ok) remove.mutate(c.id, { onError: (e) => toast(toUserMessage(e)) });
                  }}
                />
              </>
            }
          />
        );
      })}
      {editing ? (
        <ChallengeEditor
          challenge={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {board ? <BoardSheet challenge={board} onClose={() => setBoard(null)} /> : null}
    </VStack>
  );
}

function CoachFeed() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const feed = useFeed();
  const people = useCommunityPeople();
  const [moderating, setModerating] = useState<Post | null>(null);
  if (!userId) return null;
  const posts = feed.data?.pages.flat() ?? [];
  return (
    <VStack gap="md">
      <Composer uid={userId} />
      {feed.isLoading ? <LoadingState /> : null}
      {!feed.isLoading && posts.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title={t('community.empty')} />
      ) : null}
      {posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          uid={userId}
          people={people.data}
          canModerate
          onModerate={setModerating}
        />
      ))}
      {feed.hasNextPage ? (
        <Button
          variant="ghost"
          icon="chevron-down"
          label={t('community.loadMore')}
          onPress={() => void feed.fetchNextPage()}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
      {moderating ? (
        <ModerateSheet
          post={moderating}
          authorName={people.data?.get(moderating.author_id)?.display_name ?? '—'}
          authorIsCoach={!!people.data?.get(moderating.author_id)?.is_coach}
          onClose={() => setModerating(null)}
        />
      ) : null}
    </VStack>
  );
}

function ModerateSheet({
  post,
  authorName,
  authorIsCoach,
  onClose,
}: {
  post: Pick<Post, 'id' | 'author_id' | 'hidden_at' | 'photo_path'>;
  authorName: string;
  authorIsCoach: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const m = useModeration();
  const done = (msg: string) => {
    toast(msg);
    onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={t('community.moderate')}>
      <Text color="textMuted">{t('community.coach.moderateAuthor', { name: authorName })}</Text>
      <Button
        variant="secondary"
        icon={post.hidden_at ? 'eye-outline' : 'eye-off-outline'}
        label={post.hidden_at ? t('community.coach.unhide') : t('community.coach.hide')}
        onPress={() =>
          m.hidePost.mutate(
            { id: post.id, hidden: !post.hidden_at },
            {
              onSuccess: () => done(t('community.saved')),
              onError: (e) => toast(toUserMessage(e)),
            },
          )
        }
      />
      <Button
        variant="danger"
        icon="trash-outline"
        label={t('community.deletePost')}
        onPress={async () => {
          const ok = await confirm({
            title: t('community.deletePost'),
            message: t('community.deletePostConfirm'),
            confirmLabel: t('common.delete'),
            destructive: true,
          });
          if (ok) m.deletePost.mutate(post, { onSuccess: () => done(t('community.saved')) });
        }}
      />
      {!authorIsCoach ? (
        <Button
          variant="danger"
          icon="ban-outline"
          label={t('community.coach.suspend', { name: authorName })}
          onPress={async () => {
            const ok = await confirm({
              title: t('community.coach.suspendTitle'),
              message: t('community.coach.suspendConfirm', { name: authorName }),
              confirmLabel: t('community.coach.suspendTitle'),
              destructive: true,
            });
            if (ok)
              m.suspend.mutate(
                { adherentId: post.author_id, suspended: true },
                { onSuccess: () => done(t('community.coach.suspended')) },
              );
          }}
        />
      ) : null}
    </Sheet>
  );
}

function Reports() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const reports = useReports();
  const people = useCommunityPeople();
  const m = useModeration();
  if (reports.isLoading) return <LoadingState />;
  if ((reports.data ?? []).length === 0)
    return <EmptyState icon="shield-checkmark-outline" title={t('community.coach.noReports')} />;
  const name = (id: string) => people.data?.get(id)?.display_name ?? '—';
  return (
    <VStack gap="md">
      {(reports.data ?? []).map((r) => {
        const content = r.post ?? r.comment;
        const authorId = content?.author_id ?? '';
        return (
          <Card key={r.id} accent={theme.accent.alerts}>
            <VStack gap="sm">
              <HStack gap="sm">
                <Avatar id={authorId} name={name(authorId)} size={32} />
                <VStack gap="xxs" flex={1}>
                  <Text weight="700">
                    {r.post
                      ? t('community.coach.reportedPost')
                      : t('community.coach.reportedComment')}{' '}
                    · {name(authorId)}
                  </Text>
                  <Text variant="caption" color="textSubtle">
                    {t('community.coach.reportedBy', { name: name(r.reporter_id) })} ·{' '}
                    {formatRelative(r.created_at)}
                  </Text>
                </VStack>
                {content?.hidden_at ? (
                  <Badge tone="warning" label={t('community.coach.hidden')} />
                ) : null}
              </HStack>
              <Text>{content ? (content.body ?? '📷') : t('community.coach.deletedContent')}</Text>
              {r.reason ? (
                <Text variant="small" color="textMuted">
                  « {r.reason} »
                </Text>
              ) : null}
              <HStack gap="xs" wrap>
                {content ? (
                  <Button
                    variant="secondary"
                    icon="eye-off-outline"
                    label={t('community.coach.hideAndClose')}
                    onPress={() => {
                      const after = { onSuccess: () => m.resolveReport.mutate(r.id) };
                      if (r.post) m.hidePost.mutate({ id: r.post.id, hidden: true }, after);
                      else if (r.comment)
                        m.hideComment.mutate({ id: r.comment.id, hidden: true }, after);
                    }}
                  />
                ) : null}
                {content ? (
                  <Button
                    variant="ghost"
                    icon="trash-outline"
                    label={t('common.delete')}
                    onPress={() => {
                      const after = { onSuccess: () => m.resolveReport.mutate(r.id) };
                      if (r.post) m.deletePost.mutate(r.post, after);
                      else if (r.comment) m.deleteComment.mutate(r.comment.id, after);
                    }}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  icon="checkmark"
                  label={t('community.coach.ignore')}
                  onPress={() =>
                    m.resolveReport.mutate(r.id, { onError: (e) => toast(toUserMessage(e)) })
                  }
                />
              </HStack>
            </VStack>
          </Card>
        );
      })}
    </VStack>
  );
}

function CommunitySettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const rules = useXpRules();
  const save = useSaveXpRules();
  const words = useBannedWords();
  const members = useMembers();
  const m = useModeration();
  const [draft, setDraft] = useState<XpRules | null>(null);
  const [word, setWord] = useState('');
  const current = draft ?? rules.data;
  const cell = (key: keyof XpRules, max = 500) =>
    current ? (
      <NumberCell
        label={t(`community.coach.xp.${key}`)}
        showLabel
        value={current[key]}
        decimals={0}
        max={max}
        width={110}
        onCommit={(v) => setDraft({ ...current, [key]: v ?? 0 })}
      />
    ) : null;

  return (
    <VStack gap="lg">
      <VStack gap="sm">
        <SectionHeader
          title={t('community.coach.xpTitle')}
          icon="star"
          accent={theme.accent.records}
        />
        <Card>
          <VStack gap="md">
            <HStack gap="sm" wrap align="flex-end">
              {cell('session')}
              {cell('full_week')}
              {cell('checkin')}
              {cell('record')}
              {cell('record_max_per_session', 20)}
              {cell('challenge')}
              {cell('journal_day')}
              {cell('daily_cap', 2000)}
            </HStack>
            <Text variant="caption" color="textSubtle">
              {t('community.coach.xpHelp')}
            </Text>
            <Button
              icon="checkmark"
              label={t('common.save')}
              disabled={!draft}
              loading={save.isPending}
              onPress={() =>
                draft &&
                save.mutate(draft, {
                  onSuccess: () => {
                    setDraft(null);
                    toast(t('community.saved'));
                  },
                  onError: (e) => toast(toUserMessage(e)),
                })
              }
              style={{ alignSelf: 'flex-start' }}
            />
          </VStack>
        </Card>
      </VStack>

      <VStack gap="sm">
        <SectionHeader
          title={t('community.coach.membersTitle')}
          icon="people"
          accent={theme.accent.people}
        />
        <Card>
          <VStack gap="sm">
            {(members.data ?? []).length === 0 ? (
              <Text color="textMuted">{t('community.coach.noMembers')}</Text>
            ) : null}
            {(members.data ?? []).map((mb) => (
              <HStack key={mb.adherent_id} gap="sm">
                <Avatar id={mb.adherent_id} name={mb.display_name} size={30} />
                <Text style={{ flex: 1 }}>{mb.display_name}</Text>
                {mb.suspended_at ? (
                  <Badge tone="danger" label={t('community.coach.suspendedBadge')} />
                ) : null}
                <Button
                  variant="ghost"
                  label={
                    mb.suspended_at
                      ? t('community.coach.reinstate')
                      : t('community.coach.suspendTitle')
                  }
                  onPress={() =>
                    m.suspend.mutate({ adherentId: mb.adherent_id, suspended: !mb.suspended_at })
                  }
                />
              </HStack>
            ))}
          </VStack>
        </Card>
      </VStack>

      <VStack gap="sm">
        <SectionHeader
          title={t('community.coach.wordsTitle')}
          icon="ban"
          accent={theme.accent.alerts}
        />
        <Card>
          <VStack gap="sm">
            <Text variant="caption" color="textSubtle">
              {t('community.coach.wordsHelp')}
            </Text>
            <HStack gap="xs" wrap>
              {(words.data ?? []).map((w) => (
                <View
                  key={w}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: 10,
                    borderRadius: theme.radius.pill,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                >
                  <Text variant="small">{w}</Text>
                  <IconButton
                    icon="close"
                    size={16}
                    label={t('community.coach.removeWord', { word: w })}
                    onPress={() => m.removeWord.mutate(w)}
                  />
                </View>
              ))}
            </HStack>
            <HStack gap="sm" align="flex-end">
              <View style={{ flex: 1 }}>
                <TextField
                  label={t('community.coach.addWord')}
                  value={word}
                  onChangeText={setWord}
                  autoCapitalize="none"
                  maxLength={40}
                />
              </View>
              <Button
                icon="add"
                label={t('community.coach.add')}
                disabled={word.trim().length < 2}
                onPress={() =>
                  m.addWord.mutate(word, {
                    onSuccess: () => setWord(''),
                    onError: (e) => toast(toUserMessage(e)),
                  })
                }
              />
            </HStack>
          </VStack>
        </Card>
      </VStack>
    </VStack>
  );
}
