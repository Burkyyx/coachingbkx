import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, TextInput, View } from 'react-native';

import { EmptyState, HStack, IconButton, LoadingState, Text, useFeedback } from '@/components/ui';
import { formatRelative } from '@/core';
import { toUserMessage } from '@/lib/errors';
import { pickPhoto, pickVideo } from '@/lib/media';
import { useSignedUrl } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

import { markConversationRead, useMessages, useSendMessage, type Message } from './api';

function VideoBubble({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      style={{ width: 240, height: 320 }}
      contentFit="contain"
      nativeControls
    />
  );
}

function Media({ m }: { m: Message }) {
  const { t } = useTranslation();
  const url = useSignedUrl('message-media', m.media_path);
  if (!url.data)
    return (
      <Text color="textMuted">
        {m.kind === 'image' ? t('messages.photoLabel') : t('messages.videoLabel')}
      </Text>
    );
  if (m.kind === 'image') {
    return (
      <Image
        source={{ uri: url.data }}
        style={{ width: 220, height: 220, borderRadius: 10 }}
        contentFit="cover"
        accessibilityLabel={t('messages.photo')}
      />
    );
  }
  return <VideoBubble uri={url.data} />;
}

/** Fil de discussion coach ↔ adhérent (texte, photos, vidéos courtes), en temps réel. */
export function Thread({
  conversationId,
  adherentId,
  myId,
}: {
  conversationId: string;
  adherentId: string;
  myId: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const messages = useMessages(conversationId);
  const send = useSendMessage();
  const [text, setText] = useState('');
  const count = messages.data?.length ?? 0;

  useEffect(() => {
    if (count > 0) void markConversationRead(conversationId, myId);
  }, [conversationId, myId, count]);

  const submit = (extra?: Parameters<typeof send.mutate>[0]['media']) => {
    if (!extra && text.trim() === '') return;
    send.mutate(
      { conversationId, adherentId, senderId: myId, text: extra ? undefined : text, media: extra },
      {
        onSuccess: () => {
          if (!extra) setText('');
        },
        onError: (e) => toast(toUserMessage(e)),
      },
    );
  };

  const attachPhoto = async () => {
    const media = await pickPhoto();
    if (media) submit({ ...media, kind: 'image' });
  };
  const attachVideo = async () => {
    const media = await pickVideo();
    if (media === 'too_long') toast(t('messages.videoTooLong'));
    else if (media === 'too_big') toast(t('messages.videoTooBig'));
    else if (media) submit({ ...media, kind: 'video' });
  };

  return (
    <View style={{ flex: 1, gap: theme.spacing.sm }}>
      {messages.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          inverted
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <EmptyState icon="chatbubbles-outline" title={t('messages.empty')} />
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '82%',
                    padding: theme.spacing.md,
                    borderRadius: theme.radius.lg,
                    borderBottomRightRadius: mine ? 4 : theme.radius.lg,
                    borderBottomLeftRadius: mine ? theme.radius.lg : 4,
                    backgroundColor: mine ? theme.colors.primary : theme.colors.surfaceAlt,
                    gap: 4,
                  }}
                >
                  {item.kind === 'text' ? (
                    <Text color={mine ? 'onPrimary' : 'text'}>{item.body}</Text>
                  ) : (
                    <Media m={item} />
                  )}
                </View>
                <Text variant="caption" color="textSubtle">
                  {formatRelative(item.created_at)}
                  {mine && item.read_at ? ` · ${t('messages.read')}` : ''}
                </Text>
              </View>
            );
          }}
        />
      )}
      <HStack gap="xs" align="flex-end">
        <IconButton
          icon="image-outline"
          label={t('messages.photo')}
          onPress={() => void attachPhoto()}
          filled
        />
        <IconButton
          icon="videocam-outline"
          label={t('messages.video')}
          onPress={() => void attachVideo()}
          filled
        />
        <TextInput
          accessibilityLabel={t('messages.placeholder')}
          placeholder={t('messages.placeholder')}
          placeholderTextColor={theme.colors.textSubtle}
          value={text}
          onChangeText={setText}
          multiline
          onSubmitEditing={() => submit()}
          style={[
            theme.typography.body,
            {
              flex: 1,
              minHeight: 44,
              maxHeight: 140,
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 10,
            },
          ]}
        />
        <IconButton
          icon={send.isPending ? 'hourglass-outline' : 'send'}
          label={t('messages.send')}
          disabled={send.isPending}
          onPress={() => submit()}
          filled
        />
      </HStack>
    </View>
  );
}
