import { useTranslation } from 'react-i18next';

import { Button, HStack, Text, VStack } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import type { MuscleGroup } from './api';
import { BodyFigure } from './BodyFigure';
import type { BodyGender } from './bodyShapes';
import { musclesForZone, zonesForMuscles, type BodySlug, type BodyView } from './bodyZones';

const CLICKABLE = new Set<string>([
  'abs',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'deltoids',
  'forearm',
  'gluteal',
  'hamstring',
  'lower-back',
  'obliques',
  'quadriceps',
  'tibialis',
  'trapezius',
  'triceps',
  'upper-back',
] satisfies BodySlug[]);

type Props = {
  /** Muscles sélectionnés (surlignés). */
  selected: readonly MuscleGroup[];
  /** Appelé au toucher d'une zone ; un 2e toucher sur la même zone désélectionne. */
  onSelect: (muscles: MuscleGroup[]) => void;
  gender?: BodyGender;
  /** Largeur de chaque silhouette (la hauteur est le double). */
  width?: number;
};

/** Schéma du corps (face et dos) : toucher une zone filtre les exercices correspondants. */
export function BodyMap({ selected, onSelect, gender = 'male', width = 150 }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const press = (view: BodyView) => (slug: string) => {
    if (!CLICKABLE.has(slug)) return;
    const muscles = musclesForZone(slug as BodySlug, view);
    const same = muscles.length === selected.length && muscles.every((m) => selected.includes(m));
    onSelect(same ? [] : muscles);
  };

  const labelFor = (view: BodyView) => (slug: string) =>
    CLICKABLE.has(slug)
      ? musclesForZone(slug as BodySlug, view)
          .map((m) => t(`enums.muscle.${m}`))
          .join(' · ')
      : '';

  const colors = {
    muscle: theme.colors.border,
    selected: theme.colors.text,
    inert: theme.colors.background,
  };

  return (
    <VStack gap="sm" align="center">
      <HStack gap="md" justify="center" align="flex-start">
        {(['front', 'back'] as const).map((view) => (
          <VStack key={view} gap="xxs" align="center">
            <BodyFigure
              gender={gender}
              view={view}
              width={width}
              highlighted={zonesForMuscles(selected, view)}
              isClickable={(slug) => CLICKABLE.has(slug)}
              onPress={press(view)}
              colors={colors}
              labelFor={labelFor(view)}
            />
            <Text variant="caption" color="textSubtle">
              {t(`exercises.bodyView.${view}`)}
            </Text>
          </VStack>
        ))}
      </HStack>
      <HStack gap="xs" justify="center" wrap>
        <Text
          variant="small"
          weight={selected.length > 0 ? '600' : '400'}
          color={selected.length > 0 ? 'text' : 'textMuted'}
          style={{ textAlign: 'center' }}
        >
          {selected.length > 0
            ? selected.map((m) => t(`enums.muscle.${m}`)).join(' · ')
            : t('exercises.bodyHint')}
        </Text>
        {selected.length > 0 ? (
          <Button
            variant="ghost"
            icon="close"
            label={t('exercises.bodyClear')}
            onPress={() => onSelect([])}
          />
        ) : null}
      </HStack>
    </VStack>
  );
}
