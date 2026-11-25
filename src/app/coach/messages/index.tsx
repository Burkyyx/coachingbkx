import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import {
  Badge,
  Card,
  EmptyState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatRelative } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { fullName } from '@/features/coach/api';
import { useClearConversation, useCoachConversations } from '@/features/messages/api';
import { toUserMessage } from '@/lib/errors';

/** Liste des conversations (une par adhérent). */
export default function CoachMessagesScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const list = useCoachConversations(userId);
  const clear = useClearConversation();
  const { confirm, toast } = useFeedback();
  // Seules les conversations qui contiennent des messages sont listées.
  const rows = (list.data ?? []).filter((c) => c.last_message_at !== null);

  const remove = async (conversationId: string, name: string) => {
    const ok = await confirm({
      title: t('messages.clear'),
      message: t('messages.clearConfirm', { name }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await clear.mutateAsync(conversationId);
      toast(t('messages.cleared'));
    } catch (e) {
      toast(toUserMessage(e));
    }
  };

  return (
    <Screen maxWidth={900} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      <Text variant="headline" accessibilityRole="header">
        {t('messages.title')}
      </Text>
      {list.isLoading ? <LoadingState /> : null}
      {list.data && rows.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={t('messages.emptyCoach')}
          body={t('messages.emptyCoachHint')}
        />
      ) : null}
      {rows.map((c) => {
        const adherent = c.adherent as {
          first_name: string | null;
          last_name: string | null;
        } | null;
        return (
          <Card key={c.id}>
            <HStack justify="space-between" gap="sm">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={adherent ? fullName(adherent) : ''}
                onPress={() => router.push(`/coach/messages/${c.adherent_id}`)}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <VStack gap="xxs" flex={1}>
                  <Text weight={c.unread > 0 ? '800' : '600'}>
                    {adherent ? fullName(adherent) : '—'}
                  </Text>
                  <Text variant="small" color="textMuted">
                    {c.last_message_at ? formatRelative(c.last_message_at) : t('messages.empty')}
                  </Text>
                </VStack>
                {c.unread > 0 ? <Badge tone="info" label={String(c.unread)} /> : null}
              </Pressable>
              <IconButton
                icon="trash-outline"
                label={t('messages.clear')}
                onPress={() => void remove(c.id, adherent ? fullName(adherent) : '—')}
              />
            </HStack>
          </Card>
        );
      })}
    </Screen>
  );
}
