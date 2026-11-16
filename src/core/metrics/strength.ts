import { isWorkingSet, type ExerciseSession, type LoggedSet } from '../types.ts';

/**
 * 1RM estimé avec la formule d'Epley : charge × (1 + reps / 30).
 * Pour 1 rep, le 1RM est la charge elle-même. Renvoie null si incalculable.
 */
export function epley1RM(loadKg: number | null, reps: number | null): number | null {
  if (loadKg === null || reps === null || loadKg <= 0 || reps <= 0) return null;
  if (reps === 1) return loadKg;
  return loadKg * (1 + reps / 30);
}

/** Volume d'une série : charge × répétitions (kg). */
export function setVolume(set: Pick<LoggedSet, 'loadKg' | 'reps'>): number {
  if (set.loadKg === null || set.reps === null) return 0;
  return set.loadKg * set.reps;
}

/** Séries prises en compte pour les statistiques : de travail et validées. */
export function countedSets(sets: readonly LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => isWorkingSet(s) && s.completed);
}

/** Volume total (séries × reps × charge) des séries de travail validées. */
export function totalVolume(sets: readonly LoggedSet[]): number {
  return countedSets(sets).reduce((sum, s) => sum + setVolume(s), 0);
}

export function maxLoad(sets: readonly LoggedSet[]): number | null {
  const loads = countedSets(sets)
    .filter((s) => (s.reps ?? 0) > 0)
    .map((s) => s.loadKg)
    .filter((l): l is number => l !== null && l > 0);
  return loads.length ? Math.max(...loads) : null;
}

export function best1RM(sets: readonly LoggedSet[]): number | null {
  const values = countedSets(sets)
    .map((s) => epley1RM(s.loadKg, s.reps))
    .filter((v): v is number => v !== null);
  return values.length ? Math.max(...values) : null;
}

/** Point de courbe pour les graphiques par exercice. */
export type ExerciseProgressPoint = {
  date: string;
  maxLoad: number | null;
  estimated1RM: number | null;
  volume: number;
};

/** Évolution d'un exercice séance après séance (charge max, 1RM estimé, volume). */
export function exerciseProgress(sessions: readonly ExerciseSession[]): ExerciseProgressPoint[] {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: s.date,
      maxLoad: maxLoad(s.sets),
      estimated1RM: best1RM(s.sets),
      volume: totalVolume(s.sets),
    }));
}
