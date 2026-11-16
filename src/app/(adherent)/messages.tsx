import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, ErrorState, HStack, LoadingState, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useConversation } from '@/features/messages/api';
import { Thread } from '@/features/messages/Thread';

/** Messagerie de l'adhérent avec son coach. */
export default function AdherentMessagesScreen() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const conversation = useConversation(userId);
  return (
    <Screen scroll={false} maxWidth={720}>
      <HStack gap="sm">
        <Button
          variant="ghost"
          icon="arrow-back"
          label={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        />
        <Text variant="title">{t('messages.withCoach')}</Text>
      </HStack>
      {conversation.isLoading ? (
        <LoadingState />
      ) : conversation.isError || !conversation.data || !userId ? (
        <ErrorState message={t('messages.offline')} onRetry={() => void conversation.refetch()} />
      ) : (
        <Thread conversationId={conversation.data.id} adherentId={userId} myId={userId} />
      )}
    </Screen>
  );
}
