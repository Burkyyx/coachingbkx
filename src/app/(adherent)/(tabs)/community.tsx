import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Segmented,
  SectionHeader,
  Sheet,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasActiveConsent } from '@/features/auth/consents';
import {
  useCommunityPeople,
  useFeed,
  useMembership,
  useMembershipActions,
} from '@/features/community/api';
import { ChallengesView } from '@/features/community/ChallengesView';
import { Composer } from '@/features/community/Composer';
import { JoinCommunity } from '@/features/community/JoinCommunity';
import { PostCard } from '@/features/community/PostCard';
import { ProgressView } from '@/features/community/ProgressView';
import { toUserMessage } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'feed' | 'challenges' | 'progress';

/** Communauté : fil, challenges, progression (XP, niveau, badges). */
export default function CommunityTab() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { userId, consents } = useAuth();
  const membership = useMembership(userId);
  const [tab, setTab] = useState<Tab>('feed');
  const [settings, setSettings] = useState(false);

  const member =
    membership.data && !membership.data.suspended_at && hasActiveConsent(consents, 'community');

  return (
    <Screen edges={['top']} maxWidth={720}>
      <HStack justify="space-between">
        <VStack gap="xxs" flex={1}>
          <Text variant="headline" accessibilityRole="header">
            {t('community.title')}
          </Text>
          <Text color="textMuted">{t('community.subtitle')}</Text>
        </VStack>
        {member ? (
          <IconButton
            icon="settings-outline"
            label={t('community.settings')}
            onPress={() => setSettings(true)}
          />
        ) : null}
      </HStack>

      {!userId || membership.isLoading ? (
        <LoadingState />
      ) : membership.data?.suspended_at ? (
        <Card accent={theme.accent.alerts}>
          <Text>{t('community.suspended')}</Text>
        </Card>
      ) : !member ? (
        <Card accent={theme.accent.community}>
          <VStack gap="md">
            <SectionHeader
              title={t('community.joinTitle')}
              icon="people"
              accent={theme.accent.community}
            />
            <JoinCommunity />
          </VStack>
        </Card>
      ) : (
        <>
          <Segmented
            options={[
              { value: 'feed' as const, label: t('community.tabFeed') },
              { value: 'challenges' as const, label: t('community.tabChallenges') },
              { value: 'progress' as const, label: t('community.tabProgress') },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'feed' ? <Feed uid={userId} /> : null}
          {tab === 'challenges' ? <ChallengesView uid={userId} /> : null}
          {tab === 'progress' ? <ProgressView uid={userId} /> : null}
          {settings && membership.data ? (
            <SettingsSheet
              uid={userId}
              displayName={membership.data.display_name}
              autoPosts={membership.data.auto_posts}
              onClose={() => setSettings(false)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Feed({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const feed = useFeed();
  const people = useCommunityPeople();
  const posts = feed.data?.pages.flat() ?? [];
  return (
    <VStack gap="md">
      <Composer uid={uid} />
      {feed.isLoading ? <LoadingState /> : null}
      {!feed.isLoading && posts.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title={t('community.empty')} />
      ) : null}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} uid={uid} people={people.data} />
      ))}
      {feed.hasNextPage ? (
        <Button
          variant="ghost"
          icon="chevron-down"
          label={t('community.loadMore')}
          loading={feed.isFetchingNextPage}
          onPress={() => void feed.fetchNextPage()}
          style={{ alignSelf: 'center' }}
        />
      ) : null}
    </VStack>
  );
}

function SettingsSheet({
  uid,
  displayName,
  autoPosts,
  onClose,
}: {
  uid: string;
  displayName: string;
  autoPosts: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const { update, leave } = useMembershipActions(uid);
  const [name, setName] = useState(displayName);
  const [auto, setAuto] = useState(autoPosts);

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('community.settings')}
      footer={
        <Button
          icon="checkmark"
          label={t('common.save')}
          loading={update.isPending}
          disabled={!name.trim()}
          onPress={() =>
            update.mutate(
              { display_name: name.trim(), auto_posts: auto },
              {
                onSuccess: () => {
                  toast(t('community.saved'));
                  onClose();
                },
                onError: (e) => toast(toUserMessage(e)),
              },
            )
          }
        />
      }
    >
      <TextField
        label={t('community.joinPseudo')}
        hint={t('community.joinPseudoHint')}
        value={name}
        onChangeText={setName}
        maxLength={30}
        autoCapitalize="none"
      />
      <Checkbox
        checked={auto}
        onChange={setAuto}
        label={t('community.autoPosts')}
        description={t('community.autoPostsHint')}
      />
      <Button
        variant="danger"
        icon="exit-outline"
        label={t('community.leave')}
        onPress={async () => {
          const ok = await confirm({
            title: t('community.leave'),
            message: t('community.leaveConfirm'),
            confirmLabel: t('community.leave'),
            destructive: true,
          });
          if (ok) leave.mutate(undefined, { onSuccess: onClose });
        }}
        style={{ alignSelf: 'flex-start' }}
      />
    </Sheet>
  );
}
