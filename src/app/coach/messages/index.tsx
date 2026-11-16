import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Card,
  EmptyState,
  HStack,
  LoadingState,
  Screen,
  Text,
  VStack,
} from '@/components/ui';
import { formatRelative } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { fullName } from '@/features/coach/api';
import { useCoachConversations } from '@/features/messages/api';

/** Liste des conversations (une par adhérent). */
export default function CoachMessagesScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const list = useCoachConversations(userId);
  return (
    <Screen maxWidth={900} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      <Text variant="headline" accessibilityRole="header">
        {t('messages.title')}
      </Text>
      {list.isLoading ? <LoadingState /> : null}
      {list.data?.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title={t('messages.emptyCoach')} />
      ) : null}
      {(list.data ?? []).map((c) => {
        const adherent = c.adherent as {
          first_name: string | null;
          last_name: string | null;
        } | null;
        return (
          <Card
            key={c.id}
            onPress={() => router.push(`/coach/messages/${c.adherent_id}`)}
            accessibilityLabel={adherent ? fullName(adherent) : ''}
          >
            <HStack justify="space-between">
              <VStack gap="xxs" flex={1}>
                <Text weight={c.unread > 0 ? '800' : '600'}>
                  {adherent ? fullName(adherent) : '—'}
                </Text>
                <Text variant="small" color="textMuted">
                  {c.last_message_at ? formatRelative(c.last_message_at) : t('messages.empty')}
                </Text>
              </VStack>
              {c.unread > 0 ? <Badge tone="info" label={String(c.unread)} /> : null}
            </HStack>
          </Card>
        );
      })}
    </Screen>
  );
}
