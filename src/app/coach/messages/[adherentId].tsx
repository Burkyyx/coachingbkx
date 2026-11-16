import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, ErrorState, HStack, LoadingState, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAdherentProfile } from '@/features/coach/adherent';
import { fullName } from '@/features/coach/api';
import { useConversation } from '@/features/messages/api';
import { Thread } from '@/features/messages/Thread';

/** Conversation du coach avec un adhérent. */
export default function CoachThreadScreen() {
  const { t } = useTranslation();
  const { adherentId } = useLocalSearchParams<{ adherentId: string }>();
  const { userId } = useAuth();
  const conversation = useConversation(adherentId);
  const profile = useAdherentProfile(adherentId);
  return (
    <Screen scroll={false} maxWidth={900}>
      <HStack gap="sm" wrap>
        <Button
          variant="ghost"
          icon="arrow-back"
          label={t('nav.messages')}
          onPress={() => router.navigate('/coach/messages')}
        />
        <Text variant="title" onPress={() => router.push(`/coach/adherents/${adherentId}`)}>
          {profile.data ? fullName(profile.data) : ''}
        </Text>
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
