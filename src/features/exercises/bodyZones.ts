import type { MuscleGroup } from './api';

/** Zones cliquables du schéma (identifiants de react-native-body-highlighter). */
export type BodySlug =
  | 'abs'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'deltoids'
  | 'forearm'
  | 'gluteal'
  | 'hamstring'
  | 'lower-back'
  | 'obliques'
  | 'quadriceps'
  | 'tibialis'
  | 'trapezius'
  | 'triceps'
  | 'upper-back';

export type BodyView = 'front' | 'back';

/**
 * Groupes musculaires correspondant à une zone touchée sur le schéma.
 * Les épaules diffèrent selon la vue : avant/milieu de face, arrière d'épaule de dos.
 */
export function musclesForZone(slug: BodySlug, view: BodyView): MuscleGroup[] {
  switch (slug) {
    case 'chest':
      return ['chest'];
    case 'deltoids':
      return view === 'front' ? ['shoulders'] : ['rear_delts'];
    case 'biceps':
      return ['biceps'];
    case 'triceps':
      return ['triceps'];
    case 'forearm':
      return ['forearms'];
    case 'abs':
      return ['abs'];
    case 'obliques':
      return ['obliques'];
    case 'trapezius':
      return ['traps'];
    case 'upper-back':
      return ['back', 'lats'];
    case 'lower-back':
      return ['lower_back'];
    case 'gluteal':
      return ['glutes', 'abductors'];
    case 'adductors':
      return ['adductors'];
    case 'quadriceps':
      return ['quads'];
    case 'hamstring':
      return ['hamstrings'];
    case 'calves':
    case 'tibialis':
      return ['calves'];
  }
}

const ZONES: { slug: BodySlug; view: BodyView | 'both' }[] = [
  { slug: 'chest', view: 'front' },
  { slug: 'deltoids', view: 'both' },
  { slug: 'biceps', view: 'front' },
  { slug: 'triceps', view: 'both' },
  { slug: 'forearm', view: 'both' },
  { slug: 'abs', view: 'front' },
  { slug: 'obliques', view: 'front' },
  { slug: 'trapezius', view: 'both' },
  { slug: 'upper-back', view: 'back' },
  { slug: 'lower-back', view: 'back' },
  { slug: 'gluteal', view: 'back' },
  { slug: 'adductors', view: 'both' },
  { slug: 'quadriceps', view: 'front' },
  { slug: 'hamstring', view: 'back' },
  { slug: 'calves', view: 'both' },
  { slug: 'tibialis', view: 'front' },
];

/** Zones à mettre en surbrillance sur une vue pour les muscles sélectionnés. */
export function zonesForMuscles(muscles: readonly MuscleGroup[], view: BodyView): BodySlug[] {
  if (muscles.length === 0) return [];
  return ZONES.filter(
    (z) =>
      (z.view === 'both' || z.view === view) &&
      musclesForZone(z.slug, view).some((m) => muscles.includes(m)),
  ).map((z) => z.slug);
}

/** Parties du schéma non cliquables (tête, mains, pieds…). */
export const DISABLED_PARTS = ['hair', 'head', 'neck', 'hands', 'feet', 'knees', 'ankles'] as const;
