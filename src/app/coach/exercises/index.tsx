import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Badge, Button, HStack, Screen, Text, VStack } from '@/components/ui';
import { ExerciseBrowser } from '@/features/exercises/ExerciseBrowser';

/** Bibliothèque d'exercices du coach. */
export default function ExercisesScreen() {
  const { t } = useTranslation();

  return (
    <Screen scroll={false} maxWidth={1400}>
      <HStack justify="space-between" wrap>
        <Text variant="headline" accessibilityRole="header">
          {t('exercises.title')}
        </Text>
        <Button
          icon="add"
          label={t('exercises.new')}
          onPress={() => router.push('/coach/exercises/new')}
        />
      </HStack>
      <ExerciseBrowser
        allowArchived
        onOpen={(e) => router.push(`/coach/exercises/${e.id}`)}
        header={(count) => (
          <VStack gap="xxs">
            <Text color="textMuted">{t('exercises.count', { count })}</Text>
          </VStack>
        )}
        renderBadges={(item) => (
          <HStack gap="xs">
            {item.video_path || item.video_url ? (
              <Badge label={t('exercises.withVideo')} icon="videocam-outline" />
            ) : null}
            {item.archived_at ? <Badge label={t('exercises.archived')} tone="warning" /> : null}
          </HStack>
        )}
      />
    </Screen>
  );
}
