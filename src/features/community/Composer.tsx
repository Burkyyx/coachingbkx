import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, HStack, IconButton, TextField, VStack, useFeedback } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { pickPhoto } from '@/lib/media';
import { useTheme } from '@/theme/ThemeProvider';

import { isBannedWordError, usePostActions } from './api';

/** Nouveau post : texte et/ou photo. */
export function Composer({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const { create } = usePostActions(uid);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const publish = () =>
    create.mutate(
      { body, photoUri: photo },
      {
        onSuccess: () => {
          setBody('');
          setPhoto(null);
          toast(t('community.published'));
        },
        onError: (e) => toast(isBannedWordError(e) ? t('community.bannedWord') : toUserMessage(e)),
      },
    );

  return (
    <Card accent={theme.accent.community}>
      <VStack gap="sm">
        <TextField
          placeholder={t('community.composerPlaceholder')}
          accessibilityLabel={t('community.composerPlaceholder')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
        />
        {photo ? (
          <View>
            <Image
              source={{ uri: photo }}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.md }}
              contentFit="cover"
            />
            <IconButton
              icon="close-circle"
              label={t('community.removePhoto')}
              onPress={() => setPhoto(null)}
              style={{ position: 'absolute', top: 4, right: 4 }}
            />
          </View>
        ) : null}
        <HStack gap="sm" justify="space-between">
          <Button
            variant="ghost"
            icon="image-outline"
            label={t('community.addPhoto')}
            onPress={() => void pickPhoto('library').then((p) => (p ? setPhoto(p.uri) : undefined))}
          />
          <Button
            icon="send"
            label={t('community.publish')}
            loading={create.isPending}
            disabled={!body.trim() && !photo}
            onPress={publish}
          />
        </HStack>
      </VStack>
    </Card>
  );
}
