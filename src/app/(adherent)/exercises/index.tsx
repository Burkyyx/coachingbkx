import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, HStack, Screen, Text, VStack } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { ExerciseBrowser } from '@/features/exercises/ExerciseBrowser';

/**
 * Catalogue des exercices du coach, en consultation : technique, vidéos, consignes.
 * L'adhérent ne peut pas lancer de séance libre depuis ici (décision validée).
 */
export default function AdherentExercisesScreen() {
  const { t } = useTranslation();
  const { profile } = useAuth();

  return (
    <Screen scroll={false} maxWidth={1200}>
      <HStack gap="sm" align="flex-start">
        <Button
          variant="ghost"
          icon="arrow-back"
          label={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/program'))}
        />
      </HStack>
      <VStack gap="xxs">
        <Text variant="headline" accessibilityRole="header">
          {t('exercises.catalogTitle')}
        </Text>
        <Text color="textMuted">{t('exercises.catalogSubtitle')}</Text>
      </VStack>
      <ExerciseBrowser
        gender={profile?.sex === 'female' ? 'female' : 'male'}
        onOpen={(e) => router.push(`/exercises/${e.id}`)}
        header={(count) => <Text color="textMuted">{t('exercises.count', { count })}</Text>}
      />
    </Screen>
  );
}
