import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { Button, Icon, Segmented, Sheet, Text, TextField, VStack } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { filterExercises, MUSCLES, useExercises, type MuscleGroup } from './api';

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
  const { data = [] } = useExercises();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const multi = !!onPickMany;

  const list = useMemo(
    () =>
      filterExercises(data, { search, muscle, includeArchived: false }).filter(
        (e) => !excludeIds.includes(e.id),
      ),
    [data, search, muscle, excludeIds],
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
      <VStack gap="sm">
        <TextField
          placeholder={t('exercises.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          autoFocus
          accessibilityLabel={t('common.search')}
        />
        <Segmented
          scrollable
          options={muscleOptions}
          value={muscle ?? 'all'}
          onChange={(v) => setMuscle(v === 'all' ? null : v)}
        />
      </VStack>
      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        style={{ maxHeight: 420 }}
        keyboardShouldPersistTaps="handled"
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
