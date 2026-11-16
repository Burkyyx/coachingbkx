import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  HStack,
  LoadingState,
  Screen,
  Text,
  VStack,
} from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useExercises } from '@/features/exercises/api';
import { BodyFigure } from '@/features/exercises/BodyFigure';
import { zonesForMuscles } from '@/features/exercises/bodyZones';
import { ExerciseImage, ExerciseVideo } from '@/features/exercises/ExerciseVideo';
import { useTheme } from '@/theme/ThemeProvider';

/** Fiche d'un exercice côté adhérent (lecture seule). */
export default function AdherentExerciseScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useExercises();
  const exercise = data?.find((e) => e.id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/exercises'));

  if (isLoading) return <LoadingState />;
  if (isError) {
    return (
      <Screen>
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    );
  }
  if (!exercise) {
    return (
      <Screen>
        <Button variant="ghost" icon="arrow-back" label={t('common.back')} onPress={back} />
        <EmptyState icon="search-outline" title={t('exercises.empty')} />
      </Screen>
    );
  }

  const muscles = [exercise.primary_muscle, ...exercise.secondary_muscles];
  const gender = profile?.sex === 'female' ? 'female' : 'male';
  const colors = {
    muscle: theme.colors.border,
    selected: theme.colors.text,
    secondary: theme.colors.textSubtle,
    inert: theme.colors.background,
  };

  return (
    <Screen maxWidth={720}>
      <HStack>
        <Button variant="ghost" icon="arrow-back" label={t('common.back')} onPress={back} />
      </HStack>
      <VStack gap="xs">
        <Text variant="headline" accessibilityRole="header">
          {exercise.name}
        </Text>
        <HStack gap="xs" wrap>
          <Badge label={t(`enums.equipment.${exercise.equipment}`)} />
          <Badge label={t(`enums.exerciseType.${exercise.type}`)} />
        </HStack>
      </VStack>

      <ExerciseImage path={exercise.image_path} />
      <ExerciseVideo path={exercise.video_path} url={exercise.video_url} />

      <Card>
        <VStack gap="sm">
          <Text weight="700">{t('exercises.instructions')}</Text>
          <Text color={exercise.instructions ? 'text' : 'textMuted'}>
            {exercise.instructions || t('exercises.noInstructions')}
          </Text>
        </VStack>
      </Card>

      <Card>
        <VStack gap="md">
          <Text weight="700">{t('exercises.musclesWorked')}</Text>
          <VStack gap="md" align="center">
            <HStack gap="sm">
              {(['front', 'back'] as const).map((view) => (
                <BodyFigure
                  key={view}
                  gender={gender}
                  view={view}
                  width={110}
                  highlighted={zonesForMuscles([exercise.primary_muscle], view)}
                  secondary={zonesForMuscles(exercise.secondary_muscles, view)}
                  isClickable={() => false}
                  onPress={() => undefined}
                  colors={colors}
                />
              ))}
            </HStack>
            <VStack gap="xs" align="center">
              <Text>
                <Text weight="700">{t('exercises.primaryMuscle')} : </Text>
                {t(`enums.muscle.${exercise.primary_muscle}`)}
              </Text>
              {exercise.secondary_muscles.length > 0 ? (
                <Text color="textMuted">
                  <Text weight="700" color="textMuted">
                    {t('exercises.secondaryMuscles')} :{' '}
                  </Text>
                  {muscles
                    .slice(1)
                    .map((m) => t(`enums.muscle.${m}`))
                    .join(', ')}
                </Text>
              ) : null}
            </VStack>
          </VStack>
        </VStack>
      </Card>
    </Screen>
  );
}
