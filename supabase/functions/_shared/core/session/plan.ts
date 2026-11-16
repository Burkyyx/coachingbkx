// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
import { roundToStep } from '../units.ts';
import type { LoggedSet, SetType } from '../types.ts';

/**
 * Préparation d'une séance pour le mode séance :
 *  - charges cibles (kg, ou % du 1RM de référence fourni par le coach) ;
 *  - ajustement de semaine (décharge : moins de séries de travail) ;
 *  - valeurs pré-remplies (dernière performance ou cible du coach).
 */

export type PrescribedSetInput = {
  id: string;
  position: number;
  setType: SetType;
  repsMin: number | null;
  repsMax: number | null;
  loadKg: number | null;
  loadPct1rm: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  tempo: string | null;
  durationSeconds: number | null;
};

export type PlannedSet = PrescribedSetInput & {
  /** Charge cible calculée (kg), null si non définie. */
  targetLoadKg: number | null;
  /** Vrai si la charge vient d'un % du 1RM mais que le coach n'a pas renseigné de 1RM. */
  missingReference1rm: boolean;
};

export type WeekAdjustment = { volumeFactor: number; loadFactor: number } | null;

/** Charge cible d'une série prescrite. */
export function resolveTargetLoad(
  set: Pick<PrescribedSetInput, 'loadKg' | 'loadPct1rm'>,
  reference1rmKg: number | null,
  incrementKg: number,
  loadFactor = 1,
): { loadKg: number | null; missingReference1rm: boolean } {
  if (set.loadPct1rm !== null) {
    if (reference1rmKg === null) return { loadKg: set.loadKg, missingReference1rm: true };
    const raw = (reference1rmKg * set.loadPct1rm * loadFactor) / 100;
    return { loadKg: roundToStep(raw, incrementKg || 0.5), missingReference1rm: false };
  }
  if (set.loadKg === null) return { loadKg: null, missingReference1rm: false };
  if (loadFactor === 1) return { loadKg: set.loadKg, missingReference1rm: false };
  return {
    loadKg: roundToStep(set.loadKg * loadFactor, incrementKg || 0.5),
    missingReference1rm: false,
  };
}

/**
 * Applique un ajustement de semaine : en décharge, on garde une partie des séries
 * de travail (au moins une) et toutes les séries d'échauffement.
 */
export function applyVolumeFactor<T extends { setType: SetType }>(
  sets: readonly T[],
  volumeFactor: number,
): T[] {
  if (volumeFactor >= 1) return [...sets];
  const workingCount = sets.filter((s) => s.setType !== 'warmup').length;
  const keep = Math.max(1, Math.round(workingCount * volumeFactor));
  let kept = 0;
  return sets.filter((s) => {
    if (s.setType === 'warmup') return true;
    kept++;
    return kept <= keep;
  });
}

/** Construit les séries à réaliser pour un exercice. */
export function planExerciseSets(
  sets: readonly PrescribedSetInput[],
  options: { reference1rmKg: number | null; incrementKg: number; adjustment: WeekAdjustment },
): PlannedSet[] {
  const ordered = [...sets].sort((a, b) => a.position - b.position);
  const adjusted = applyVolumeFactor(ordered, options.adjustment?.volumeFactor ?? 1);
  return adjusted.map((s) => {
    const target = resolveTargetLoad(
      s,
      options.reference1rmKg,
      options.incrementKg,
      options.adjustment?.loadFactor ?? 1,
    );
    return { ...s, targetLoadKg: target.loadKg, missingReference1rm: target.missingReference1rm };
  });
}

export type Prefill = {
  loadKg: number | null;
  reps: number | null;
  source: 'target' | 'last' | 'none';
};

/**
 * Valeurs pré-remplies d'une série :
 *  - charge : la cible du coach si elle existe (elle intègre les progressions validées),
 *    sinon la charge de la dernière performance ;
 *  - reps : celles de la dernière performance si elle a été faite à la même charge,
 *    sinon le bas de la fourchette cible.
 */
export function prefillSet(
  planned: PlannedSet,
  last: Pick<LoggedSet, 'loadKg' | 'reps'> | null,
): Prefill {
  const targetReps = planned.repsMin ?? planned.repsMax;
  if (planned.targetLoadKg !== null) {
    const sameLoad =
      last && last.loadKg !== null && Math.abs(last.loadKg - planned.targetLoadKg) < 0.01;
    return {
      loadKg: planned.targetLoadKg,
      reps: sameLoad && last?.reps ? last.reps : targetReps,
      source: 'target',
    };
  }
  if (last && (last.loadKg !== null || last.reps !== null)) {
    return { loadKg: last.loadKg, reps: last.reps ?? targetReps, source: 'last' };
  }
  return { loadKg: null, reps: targetReps, source: 'none' };
}

/** Durée de repos réelle (s) entre deux instants, plafonnée à 1 heure. */
export function actualRestSeconds(startedAtMs: number, endedAtMs: number): number {
  return Math.min(3600, Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000)));
}
