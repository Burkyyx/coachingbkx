import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  IconBadge,
  IconButton,
  Text,
  TextField,
  VStack,
  useFeedback,
  type IconName,
} from '@/components/ui';
import { formatNumber, formatRelative, isBadgeKey, levelFor } from '@/core';
import { toUserMessage } from '@/lib/errors';
import { useSignedUrl } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

import { levelName } from './levels';
import {
  REACTIONS,
  isBannedWordError,
  useCommentActions,
  useComments,
  usePostActions,
  type Person,
  type Post,
} from './api';

/** Nom + niveau d'une personne de la communauté. */
export function useWho(people: Map<string, Person> | undefined) {
  const { t } = useTranslation();
  return (id: string) => {
    const p = people?.get(id);
    const name = p?.display_name ?? t('community.coachBadge');
    const level = p && !p.is_coach ? levelFor(p.xp) : null;
    return { name, person: p, level };
  };
}

/** Texte d'un post automatique (aucun chiffre de poids ni de nutrition). */
function useAutoText() {
  const { t } = useTranslation();
  return (post: Post): { text: string; icon: IconName } | null => {
    const p = (post.payload ?? {}) as Record<string, unknown>;
    switch (post.kind) {
      case 'session':
        return {
          icon: 'barbell',
          text: p.workout_name
            ? t('community.auto.session', { name: String(p.workout_name) })
            : t('community.auto.sessionNoName'),
        };
      case 'record': {
        const type = String(p.record_type ?? 'max_load') as
          'max_load' | 'estimated_1rm' | 'reps_at_load' | 'session_volume';
        const value = t(`community.recordValue.${type}`, {
          value: formatNumber(Number(p.value ?? 0), 1),
          reps: formatNumber(Number(p.value ?? 0), 0),
          load: formatNumber(Number(p.load_kg ?? 0), 2),
        });
        return {
          icon: 'trophy',
          text: t('community.auto.record', { exercise: String(p.exercise_name ?? ''), value }),
        };
      }
      case 'badge': {
        const key = String(p.badge ?? '');
        return {
          icon: 'ribbon',
          text: t('community.auto.badge', {
            badge: isBadgeKey(key) ? t(`community.badges.${key}`) : key,
          }),
        };
      }
      case 'challenge':
        return {
          icon: 'flag',
          text: t('community.auto.challenge', { title: String(p.title ?? '') }),
        };
      default:
        return null;
    }
  };
}

export function PostCard({
  post,
  uid,
  people,
  canModerate = false,
  onModerate,
}: {
  post: Post;
  uid: string;
  people: Map<string, Person> | undefined;
  /** Espace coach : boutons de modération à la place du signalement. */
  canModerate?: boolean;
  onModerate?: (post: Post) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast, confirm } = useFeedback();
  const who = useWho(people);
  const autoText = useAutoText();
  const actions = usePostActions(uid);
  const photo = useSignedUrl('community-media', post.photo_path);
  const [open, setOpen] = useState(false);

  const author = who(post.author_id);
  const auto = autoText(post);
  const mine = post.author_id === uid;
  const commentsCount = post.comments[0]?.count ?? 0;
  const accent =
    post.kind === 'record'
      ? theme.accent.records
      : post.kind === 'session'
        ? theme.accent.training
        : post.kind === 'badge'
          ? theme.accent.checkins
          : post.kind === 'challenge'
            ? theme.accent.suggestions
            : undefined;

  const onDelete = async () => {
    const ok = await confirm({
      title: t('community.deletePost'),
      message: t('community.deletePostConfirm'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (ok) actions.remove.mutate(post, { onError: (e) => toast(toUserMessage(e)) });
  };
  const onReport = async () => {
    const ok = await confirm({
      title: t('community.report'),
      message: t('community.reportConfirm'),
      confirmLabel: t('community.report'),
    });
    if (ok)
      actions.report.mutate(
        { postId: post.id },
        {
          onSuccess: () => toast(t('community.reported')),
          onError: (e) => toast(toUserMessage(e)),
        },
      );
  };

  return (
    <Card accent={accent}>
      <VStack gap="sm">
        <HStack gap="sm" align="flex-start">
          <Avatar id={post.author_id} name={author.name} size={38} />
          <VStack gap="xxs" flex={1}>
            <HStack gap="xs" wrap>
              <Text weight="700">{author.name}</Text>
              {author.person?.is_coach ? (
                <Badge tone="info" label={t('community.coachBadge')} />
              ) : author.level ? (
                <Text variant="caption" color="textSubtle">
                  {t('community.level', {
                    n: author.level.index + 1,
                    name: levelName(t, author.level.index),
                  })}
                </Text>
              ) : null}
            </HStack>
            <Text variant="caption" color="textSubtle">
              {formatRelative(post.created_at)}
            </Text>
          </VStack>
          {mine || canModerate ? (
            canModerate && onModerate ? (
              <IconButton
                icon="shield-checkmark-outline"
                label={t('community.moderate')}
                onPress={() => onModerate(post)}
              />
            ) : (
              <IconButton
                icon="trash-outline"
                label={t('community.deletePost')}
                onPress={() => void onDelete()}
              />
            )
          ) : (
            <IconButton
              icon="flag-outline"
              label={t('community.report')}
              color="textSubtle"
              onPress={() => void onReport()}
            />
          )}
        </HStack>

        {post.hidden_at ? (
          <Text variant="caption" color="warning">
            {t('community.hiddenByCoach')}
          </Text>
        ) : null}

        {auto ? (
          <HStack gap="sm">
            {accent ? <IconBadge icon={auto.icon} color={accent} size={30} /> : null}
            <Text style={{ flex: 1 }}>{auto.text}</Text>
          </HStack>
        ) : null}
        {post.body ? <Text>{post.body}</Text> : null}
        {post.photo_path ? (
          <Image
            source={photo.data ? { uri: photo.data } : undefined}
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surfaceAlt,
            }}
            contentFit="cover"
            accessibilityLabel={t('community.addPhoto')}
          />
        ) : null}

        <HStack gap="xs" wrap>
          {REACTIONS.map((emoji) => {
            const count = post.reactions.filter((r) => r.emoji === emoji).length;
            const on = post.reactions.some((r) => r.emoji === emoji && r.author_id === uid);
            return (
              <Pressable
                key={emoji}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('community.react', { emoji })}
                onPress={() => actions.react.mutate({ post: post.id, emoji, on: !on })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  minHeight: 34,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: on ? theme.accent.training : theme.colors.border,
                  backgroundColor: on ? `${theme.accent.training}22` : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text>{emoji}</Text>
                {count > 0 ? (
                  <Text variant="small" weight="700" tabular>
                    {count}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          <View style={{ flex: 1 }} />
          <Button
            variant="ghost"
            icon="chatbubble-outline"
            label={
              commentsCount > 0
                ? t('community.comments', { count: commentsCount })
                : t('community.comment')
            }
            onPress={() => setOpen((v) => !v)}
          />
        </HStack>

        {open ? (
          <Comments postId={post.id} uid={uid} people={people} canModerate={canModerate} />
        ) : null}
      </VStack>
    </Card>
  );
}

function Comments({
  postId,
  uid,
  people,
  canModerate,
}: {
  postId: string;
  uid: string;
  people: Map<string, Person> | undefined;
  canModerate: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast, confirm } = useFeedback();
  const who = useWho(people);
  const comments = useComments(postId, true);
  const { add, remove } = useCommentActions(uid, postId);
  const postActions = usePostActions(uid);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!draft.trim()) return;
    add.mutate(draft, {
      onSuccess: () => setDraft(''),
      onError: (e) => toast(isBannedWordError(e) ? t('community.bannedWord') : toUserMessage(e)),
    });
  };

  return (
    <VStack
      gap="sm"
      style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 }}
    >
      {(comments.data ?? []).map((c) => {
        const a = who(c.author_id);
        const mine = c.author_id === uid;
        return (
          <HStack key={c.id} gap="sm" align="flex-start">
            <Avatar id={c.author_id} name={a.name} size={28} />
            <VStack gap="xxs" flex={1}>
              <Text variant="small" weight="700">
                {a.name}{' '}
                <Text variant="caption" color="textSubtle">
                  · {formatRelative(c.created_at)}
                </Text>
              </Text>
              <Text variant="small">{c.body}</Text>
              {c.hidden_at ? (
                <Text variant="caption" color="warning">
                  {t('community.hiddenByCoach')}
                </Text>
              ) : null}
            </VStack>
            {mine || canModerate ? (
              <IconButton
                icon="trash-outline"
                size={18}
                label={t('community.deleteComment')}
                onPress={async () => {
                  const ok = await confirm({
                    title: t('community.deleteComment'),
                    message: t('community.deleteComment'),
                    confirmLabel: t('common.delete'),
                    destructive: true,
                  });
                  if (ok) remove.mutate(c.id);
                }}
              />
            ) : (
              <IconButton
                icon="flag-outline"
                size={18}
                color="textSubtle"
                label={t('community.report')}
                onPress={async () => {
                  const ok = await confirm({
                    title: t('community.report'),
                    message: t('community.reportConfirm'),
                    confirmLabel: t('community.report'),
                  });
                  if (ok)
                    postActions.report.mutate(
                      { commentId: c.id },
                      { onSuccess: () => toast(t('community.reported')) },
                    );
                }}
              />
            )}
          </HStack>
        );
      })}
      <HStack gap="sm" align="flex-end">
        <View style={{ flex: 1 }}>
          <TextField
            placeholder={t('community.commentPlaceholder')}
            accessibilityLabel={t('community.comment')}
            value={draft}
            onChangeText={setDraft}
            maxLength={1000}
            onSubmitEditing={send}
          />
        </View>
        <Button
          icon="send"
          label={t('community.send')}
          loading={add.isPending}
          disabled={!draft.trim()}
          onPress={send}
        />
      </HStack>
    </VStack>
  );
}
