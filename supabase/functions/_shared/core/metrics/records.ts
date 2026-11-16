// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
import { countedSets, epley1RM, totalVolume } from './strength.ts';
import type { ExerciseSession, LoggedSet } from '../types.ts';

export type RecordType = 'max_load' | 'estimated_1rm' | 'reps_at_load' | 'session_volume';

export type RecordDraft = {
  recordType: RecordType;
  /** kg pour max_load / estimated_1rm / session_volume ; nombre de reps pour reps_at_load. */
  value: number;
  /** Charge associée (pour reps_at_load). */
  loadKg: number | null;
  /** Ancien record battu (null si aucun). */
  previous: number | null;
};

/** Tolérance pour éviter les « records » dus aux arrondis. */
const EPSILON = 0.01;

/**
 * Détecte si une série validée bat un record, par rapport à toutes les séries
 * précédentes de l'exercice (historique + séries déjà faites dans la séance).
 *
 * Règles :
 *  - pas d'historique → pas de record (la toute première séance n'est pas un record) ;
 *  - un seul record par série, le plus parlant : charge max > 1RM estimé > reps à une charge.
 */
export function detectSetRecord(
  set: LoggedSet,
  priorSets: readonly LoggedSet[],
): RecordDraft | null {
  if (!set.completed || set.setType === 'warmup' || set.reps === null || set.reps <= 0) return null;
  const prior = countedSets(priorSets).filter((s) => (s.reps ?? 0) > 0);
  if (prior.length === 0) return null;

  const load = set.loadKg ?? 0;

  // 1. Charge maximale
  const priorMaxLoad = Math.max(...prior.map((s) => s.loadKg ?? 0));
  if (load > 0 && load > priorMaxLoad + EPSILON) {
    return { recordType: 'max_load', value: load, loadKg: load, previous: priorMaxLoad || null };
  }

  // 2. 1RM estimé
  const e1rm = epley1RM(set.loadKg, set.reps);
  const priorE1rm = prior
    .map((s) => epley1RM(s.loadKg, s.reps))
    .filter((v): v is number => v !== null);
  const bestPriorE1rm = priorE1rm.length ? Math.max(...priorE1rm) : null;
  if (e1rm !== null && bestPriorE1rm !== null && e1rm > bestPriorE1rm + 0.5) {
    return {
      recordType: 'estimated_1rm',
      value: Math.round(e1rm * 10) / 10,
      loadKg: load,
      previous: Math.round(bestPriorE1rm * 10) / 10,
    };
  }

  // 3. Plus de répétitions qu'avant à cette charge (ou plus lourd)
  const atLeastAsHeavy = prior.filter((s) => (s.loadKg ?? 0) >= load - EPSILON);
  if (atLeastAsHeavy.length > 0) {
    const bestReps = Math.max(...atLeastAsHeavy.map((s) => s.reps ?? 0));
    if (set.reps > bestReps) {
      return { recordType: 'reps_at_load', value: set.reps, loadKg: load, previous: bestReps };
    }
  }
  return null;
}

/** Record de volume sur l'exercice pour la séance (calculé en fin de séance). */
export function detectSessionVolumeRecord(
  currentSets: readonly LoggedSet[],
  previousSessions: readonly ExerciseSession[],
): RecordDraft | null {
  const volume = totalVolume(currentSets);
  if (volume <= 0 || previousSessions.length === 0) return null;
  const best = Math.max(...previousSessions.map((s) => totalVolume(s.sets)));
  if (volume > best + EPSILON) {
    return { recordType: 'session_volume', value: volume, loadKg: null, previous: best || null };
  }
  return null;
}
