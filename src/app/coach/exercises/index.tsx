import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  HStack,
  Icon,
  LoadingState,
  Screen,
  Segmented,
  Text,
  TextField,
  VStack,
} from '@/components/ui';
import { filterExercises, MUSCLES, useExercises, type MuscleGroup } from '@/features/exercises/api';
import { useTheme } from '@/theme/ThemeProvider';

/** Bibliothèque d'exercices du coach. */
export default function ExercisesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data, isLoading, isError, refetch } = useExercises();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);

  const list = useMemo(
    () => filterExercises(data ?? [], { search, muscle, includeArchived }),
    [data, search, muscle, includeArchived],
  );

  return (
    <Screen scroll={false}>
      <HStack justify="space-between" wrap>
        <VStack gap="xxs">
          <Text variant="headline" accessibilityRole="header">
            {t('exercises.title')}
          </Text>
          <Text color="textMuted">{t('exercises.count', { count: list.length })}</Text>
        </VStack>
        <Button
          icon="add"
          label={t('exercises.new')}
          onPress={() => router.push('/coach/exercises/new')}
        />
      </HStack>
      <TextField
        placeholder={t('exercises.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel={t('common.search')}
      />
      <Segmented
        scrollable
        options={[
          { value: 'all' as const, label: t('exercises.allMuscles') },
          ...MUSCLES.map((m) => ({ value: m, label: t(`enums.muscle.${m}`) })),
        ]}
        value={muscle ?? 'all'}
        onChange={(v) => setMuscle(v === 'all' ? null : v)}
      />
      <Checkbox
        checked={includeArchived}
        onChange={setIncludeArchived}
        label={t('exercises.showArchived')}
      />
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<EmptyState icon="search-outline" title={t('exercises.empty')} />}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: theme.colors.border }} />
          )}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => router.push(`/coach/exercises/${item.id}`)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="600" color={item.archived_at ? 'textSubtle' : 'text'}>
                  {item.name}
                </Text>
                <Text variant="small" color="textMuted">
                  {t(`enums.muscle.${item.primary_muscle}`)} ·{' '}
                  {t(`enums.equipment.${item.equipment}`)} · {t(`enums.exerciseType.${item.type}`)}
                </Text>
              </View>
              <HStack gap="xs">
                {item.video_path || item.video_url ? (
                  <Badge label={t('exercises.withVideo')} icon="videocam-outline" />
                ) : null}
                {item.archived_at ? <Badge label={t('exercises.archived')} tone="warning" /> : null}
              </HStack>
              <Icon name="chevron-forward" color="textSubtle" size={18} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}
