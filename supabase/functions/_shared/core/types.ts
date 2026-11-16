// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Types métier partagés par les algorithmes (indépendants de la base de données).
 */

export type SetType = 'warmup' | 'working' | 'drop' | 'failure' | 'backoff' | 'amrap';
export type EffortScale = 'rir' | 'rpe';

/** Une série réalisée, telle qu'utilisée par les algorithmes. */
export type LoggedSet = {
  id?: string;
  setType: SetType;
  loadKg: number | null;
  reps: number | null;
  /** Reps en réserve ressenties (si l'adhérent utilise le RIR). */
  rir: number | null;
  /** Effort perçu /10 (si l'adhérent utilise le RPE). */
  rpe: number | null;
  completed: boolean;
  restSecondsActual?: number | null;
  restSecondsPrescribed?: number | null;
};

/** Toutes les séries d'un exercice lors d'une séance. */
export type ExerciseSession = {
  sessionId: string;
  /** Date ISO de la séance. */
  date: string;
  sets: LoggedSet[];
};

/** Prescription du coach pour les séries de travail d'un exercice. */
export type Prescription = {
  repsMin: number | null;
  repsMax: number | null;
  loadKg: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
};

/** Séries comptées pour la progression : séries de travail validées. */
export function isWorkingSet(set: LoggedSet): boolean {
  return set.setType !== 'warmup';
}

/** RIR effectif : RIR saisi, ou déduit du RPE (RIR ≈ 10 − RPE). */
export function effectiveRir(set: Pick<LoggedSet, 'rir' | 'rpe'>): number | null {
  if (set.rir !== null && set.rir !== undefined) return set.rir;
  if (set.rpe !== null && set.rpe !== undefined) return Math.max(0, 10 - set.rpe);
  return null;
}

/** RIR cible effectif : RIR cible, ou déduit du RPE cible. */
export function targetRirOf(p: Pick<Prescription, 'targetRir' | 'targetRpe'>): number | null {
  if (p.targetRir !== null) return p.targetRir;
  if (p.targetRpe !== null) return Math.max(0, 10 - p.targetRpe);
  return null;
}
