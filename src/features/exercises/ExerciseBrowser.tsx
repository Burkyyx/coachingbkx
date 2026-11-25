import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { useIsDesktop } from '@/components/AppNav';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  Segmented,
  Text,
  TextField,
  VStack,
} from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { filterExercises, MUSCLES, useExercises, type Exercise, type MuscleGroup } from './api';
import { BodyMap } from './BodyMap';
import { ExerciseThumb } from './ExerciseVideo';

type Props = {
  onOpen: (exercise: Exercise) => void;
  /** Case « Afficher les archivés » (coach uniquement). */
  allowArchived?: boolean;
  /** Éléments affichés à droite de chaque ligne (badges…). */
  renderBadges?: (exercise: Exercise) => ReactNode;
  gender?: 'male' | 'female';
  /** Appelé quand le nombre d'exercices affichés change. */
  header?: (count: number) => ReactNode;
};

/**
 * Parcourir la bibliothèque : recherche, schéma du corps cliquable, pastilles de muscles.
 * Ordinateur : schéma à gauche, liste à droite. Téléphone : schéma repliable au-dessus.
 */
export function ExerciseBrowser({ onOpen, allowArchived, renderBadges, gender, header }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const desktop = useIsDesktop();
  const { data, isLoading, isError, refetch } = useExercises();
  const [search, setSearch] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);

  const list = useMemo(
    () =>
      filterExercises(data ?? [], {
        search,
        muscles,
        includeArchived: !!allowArchived && includeArchived,
      }),
    [data, search, muscles, includeArchived, allowArchived],
  );

  // Pastille active : « Tous », ou le muscle s'il n'y en a qu'un (sinon aucune).
  const chipValue = muscles.length === 0 ? 'all' : muscles.length === 1 ? muscles[0] : null;

  /** Choix d'un muscle (schéma ou pastille) : sur téléphone, le schéma se replie. */
  const chooseMuscles = (m: MuscleGroup[]) => {
    setMuscles(m);
    if (m.length > 0) setBodyOpen(false);
  };

  const body = (
    <BodyMap
      selected={muscles}
      onSelect={chooseMuscles}
      gender={gender}
      width={desktop ? 160 : 130}
    />
  );

  const filters = (
    <VStack gap="sm">
      <TextField
        placeholder={t('exercises.searchPlaceholder')}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel={t('common.search')}
      />
      {!desktop ? (
        <Button
          variant="secondary"
          icon={bodyOpen ? 'chevron-up' : 'body-outline'}
          label={bodyOpen ? t('exercises.hideBody') : t('exercises.showBody')}
          onPress={() => setBodyOpen((v) => !v)}
        />
      ) : null}
      {!desktop && bodyOpen ? <Card>{body}</Card> : null}
      <Segmented
        scrollable
        options={[
          { value: 'all' as const, label: t('exercises.allMuscles') },
          ...MUSCLES.map((m) => ({ value: m, label: t(`enums.muscle.${m}`) })),
        ]}
        value={chipValue}
        onChange={(v) => chooseMuscles(v === 'all' ? [] : [v])}
      />
      {allowArchived ? (
        <Checkbox
          checked={includeArchived}
          onChange={setIncludeArchived}
          label={t('exercises.showArchived')}
        />
      ) : null}
      {header?.(list.length)}
    </VStack>
  );

  const content = isLoading ? (
    <LoadingState />
  ) : isError ? (
    <ErrorState onRetry={() => void refetch()} />
  ) : (
    <FlatList
      data={list}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={desktop ? undefined : filters}
      ListHeaderComponentStyle={{ marginBottom: theme.spacing.sm }}
      ListEmptyComponent={<EmptyState icon="search-outline" title={t('exercises.empty')} />}
      ItemSeparatorComponent={() => (
        <View style={{ height: 1, backgroundColor: theme.colors.border }} />
      )}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.name}
          onPress={() => onOpen(item)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <ExerciseThumb imagePath={item.image_path} videoUrl={item.video_url} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="600" color={item.archived_at ? 'textSubtle' : 'text'}>
              {item.name}
            </Text>
            <Text variant="small" color="textMuted">
              {t(`enums.muscle.${item.primary_muscle}`)} · {t(`enums.equipment.${item.equipment}`)}
            </Text>
          </View>
          {renderBadges?.(item)}
          <Icon name="chevron-forward" color="textSubtle" size={18} />
        </Pressable>
      )}
    />
  );

  if (!desktop) return <View style={{ flex: 1 }}>{content}</View>;

  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.lg }}>
      <View style={{ width: 380 }}>
        <Card>{body}</Card>
      </View>
      <View style={{ flex: 1, gap: theme.spacing.sm }}>
        {filters}
        {content}
      </View>
    </View>
  );
}
