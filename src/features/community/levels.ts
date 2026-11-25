import type { TFunction } from 'i18next';

const LEVEL_KEYS = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'] as const;

/** Nom du niveau (0 → 7) : Recrue … Légende. */
export function levelName(t: TFunction, index: number): string {
  return t(`community.levels.${LEVEL_KEYS[index] ?? 'l0'}`);
}
