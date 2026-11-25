import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { Button, Icon, Segmented, Sheet, Text, TextField, VStack } from '@/components/ui';
import { useIsDesktop } from '@/components/AppNav';
import { useTheme } from '@/theme/ThemeProvider';

import { filterExercises, MUSCLES, useExercises, type MuscleGroup } from './api';
import { BodyMap } from './BodyMap';
import { ExerciseThumb } from './ExerciseVideo';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Sélection simple : appelé dès qu'un exercice est choisi. */
  onPick?: (exerciseId: string) => void;
  /** Sélection multiple : appelé au clic sur « Ajouter ». */
  onPickMany?: (exerciseIds: string[]) => void;
  excludeIds?: readonly string[];
  title?: string;
};

/** Fenêtre de choix d'exercice(s) avec recherche et filtre par muscle. */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  onPickMany,
  excludeIds = [],
  title,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const desktop = useIsDesktop();
  const { data = [] } = useExercises();
  const [search, setSearch] = useState('');
  const [muscles, setMuscles] = useState<MuscleGroup[]>([]);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const multi = !!onPickMany;

  const list = useMemo(
    () =>
      filterExercises(data, { search, muscles, includeArchived: false }).filter(
        (e) => !excludeIds.includes(e.id),
      ),
    [data, search, muscles, excludeIds],
  );

  const muscleOptions = [
    { value: 'all' as const, label: t('exercises.allMuscles') },
    ...MUSCLES.map((m) => ({ value: m, label: t(`enums.muscle.${m}`) })),
  ];

  const close = () => {
    setSelected([]);
    setSearch('');
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={title ?? (multi ? t('exercises.pickMany') : t('exercises.pick'))}
      scroll={false}
      footer={
        multi ? (
          <Button
            label={t('exercises.validateSelection', { count: selected.length })}
            disabled={selected.length === 0}
            onPress={() => {
              onPickMany?.(selected);
              close();
            }}
            fullWidth
          />
        ) : undefined
      }
    >
      {/* Recherche, schéma et filtres défilent avec la liste : sur téléphone (clavier ouvert,
          petit écran), la liste n'est plus écrasée par le schéma. */}
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        style={{ flexGrow: 0, flexShrink: 1 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <VStack gap="sm" style={{ paddingBottom: theme.spacing.sm }}>
            <TextField
              placeholder={t('exercises.searchPlaceholder')}
              value={search}
              onChangeText={setSearch}
              // Sur téléphone, le clavier ouvert d'office cacherait la moitié de la liste.
              autoFocus={desktop}
              accessibilityLabel={t('common.search')}
            />
            <Button
              variant="secondary"
              icon={bodyOpen ? 'chevron-up' : 'body-outline'}
              label={bodyOpen ? t('exercises.hideBody') : t('exercises.showBody')}
              onPress={() => setBodyOpen((v) => !v)}
            />
            {bodyOpen ? (
              <BodyMap
                selected={muscles}
                onSelect={(m) => {
                  setMuscles(m);
                  // Sur téléphone, on replie le schéma pour montrer tout de suite les exercices.
                  if (!desktop && m.length > 0) setBodyOpen(false);
                }}
                width={110}
              />
            ) : null}
            <Segmented
              scrollable
              options={muscleOptions}
              value={muscles.length === 0 ? 'all' : muscles.length === 1 ? muscles[0] : null}
              onChange={(v) => setMuscles(v === 'all' ? [] : [v])}
            />
          </VStack>
        }
        ListEmptyComponent={<Text color="textMuted">{t('exercises.empty')}</Text>}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          return (
            <Pressable
              accessibilityRole={multi ? 'checkbox' : 'button'}
              accessibilityState={multi ? { checked: isSelected } : undefined}
              accessibilityLabel={item.name}
              onPress={() => {
                if (multi) {
                  setSelected((s) =>
                    isSelected ? s.filter((x) => x !== item.id) : [...s, item.id],
                  );
                } else {
                  onPick?.(item.id);
                  close();
                }
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: 52,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor: isSelected || pressed ? theme.colors.surfaceAlt : 'transparent',
              })}
            >
              <ExerciseThumb imagePath={item.image_path} videoUrl={item.video_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text weight="600">{item.name}</Text>
                <Text variant="caption" color="textMuted">
                  {t(`enums.muscle.${item.primary_muscle}`)} ·{' '}
                  {t(`enums.equipment.${item.equipment}`)}
                </Text>
              </View>
              {multi ? (
                <Icon
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  color={isSelected ? 'text' : 'textSubtle'}
                />
              ) : (
                <Icon name="add-circle-outline" color="textMuted" />
              )}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}
