import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Button,
  ErrorState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Text,
  useFeedback,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAdherentProfile } from '@/features/coach/adherent';
import { fullName } from '@/features/coach/api';
import { useClearConversation, useConversation } from '@/features/messages/api';
import { toUserMessage } from '@/lib/errors';
import { Thread } from '@/features/messages/Thread';

/** Conversation du coach avec un adhérent. */
export default function CoachThreadScreen() {
  const { t } = useTranslation();
  const { adherentId } = useLocalSearchParams<{ adherentId: string }>();
  const { userId } = useAuth();
  const conversation = useConversation(adherentId);
  const profile = useAdherentProfile(adherentId);
  const clear = useClearConversation();
  const { confirm, toast } = useFeedback();
  const name = profile.data ? fullName(profile.data) : '';

  const remove = async () => {
    if (!conversation.data) return;
    const ok = await confirm({
      title: t('messages.clear'),
      message: t('messages.clearConfirm', { name }),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await clear.mutateAsync(conversation.data.id);
      toast(t('messages.cleared'));
      router.navigate('/coach/messages');
    } catch (e) {
      toast(toUserMessage(e));
    }
  };

  return (
    <Screen scroll={false} maxWidth={900}>
      <HStack gap="sm" wrap>
        <Button
          variant="ghost"
          icon="arrow-back"
          label={t('nav.messages')}
          onPress={() => router.navigate('/coach/messages')}
        />
        <Text
          variant="title"
          style={{ flex: 1 }}
          onPress={() => router.push(`/coach/adherents/${adherentId}`)}
        >
          {name}
        </Text>
        {conversation.data ? (
          <IconButton
            icon="trash-outline"
            label={t('messages.clear')}
            onPress={() => void remove()}
          />
        ) : null}
      </HStack>
      {conversation.isLoading ? (
        <LoadingState />
      ) : conversation.isError || !conversation.data || !userId ? (
        <ErrorState onRetry={() => void conversation.refetch()} />
      ) : (
        <Thread conversationId={conversation.data.id} adherentId={adherentId} myId={userId} />
      )}
    </Screen>
  );
}
