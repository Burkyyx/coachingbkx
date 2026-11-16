// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
import { totalVolume } from '../metrics/strength.ts';
import type { LoggedSet } from '../types.ts';

export type SessionSummary = {
  durationSeconds: number;
  /** Séries de travail validées. */
  completedSets: number;
  totalReps: number;
  totalVolumeKg: number;
};

/** Résumé de fin de séance (durée, volume, séries). */
export function summarizeSession(
  startedAtMs: number,
  endedAtMs: number,
  sets: readonly LoggedSet[],
): SessionSummary {
  const counted = sets.filter((s) => s.setType !== 'warmup' && s.completed);
  return {
    durationSeconds: Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000)),
    completedSets: counted.length,
    totalReps: counted.reduce((sum, s) => sum + (s.reps ?? 0), 0),
    totalVolumeKg: Math.round(totalVolume(sets)),
  };
}
