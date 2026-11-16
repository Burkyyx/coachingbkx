import type { ExerciseSession, LoggedSet, Prescription } from '../types';

/** Fabrique une série (valeurs par défaut : série de travail validée). */
export function set(
  loadKg: number | null,
  reps: number | null,
  extra: Partial<LoggedSet> = {},
): LoggedSet {
  return { setType: 'working', loadKg, reps, rir: null, rpe: null, completed: true, ...extra };
}

let counter = 0;
/** Fabrique une séance d'exercice : séries [charge, reps, rir?]. */
export function session(
  date: string,
  sets: [number | null, number | null, number?][],
  extra: Partial<LoggedSet> = {},
): ExerciseSession {
  counter++;
  return {
    sessionId: `s${counter}`,
    date,
    sets: sets.map(([l, r, rir]) => set(l, r, { rir: rir ?? null, ...extra })),
  };
}

export function prescription(p: Partial<Prescription> = {}): Prescription {
  return {
    repsMin: 8,
    repsMax: 12,
    loadKg: 60,
    targetRir: 2,
    targetRpe: null,
    restSeconds: 120,
    ...p,
  };
}
