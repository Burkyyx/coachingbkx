import { formatKg, formatNumber, formatRepRange } from '../format.ts';
import { floorToStep, mode, roundToStep } from '../units.ts';
import {
  effectiveRir,
  targetRirOf,
  type ExerciseSession,
  type LoggedSet,
  type Prescription,
} from '../types.ts';
import type { DoubleProgressionParams } from './rules.ts';

/**
 * §8.1 — Double progression.
 *  - Haut de fourchette atteint sur TOUTES les séries de travail avec RIR ≥ RIR cible
 *    → hausse de charge (incrément de l'exercice).
 *  - Reps dans la fourchette → garder la charge et viser +1 rep.
 *  - Sous le bas de la fourchette N séances de suite → garder ou baisser de 5–10 %.
 */

export type ProgressionInput = {
  exerciseName: string;
  /** Incrément de charge de l'exercice (kg). */
  incrementKg: number;
  /** false pour le poids du corps / cardio / exercices au temps : pas de suggestion de charge. */
  loadable: boolean;
  prescription: Prescription;
  /** Séances sur cet exercice, de la plus ancienne à la plus récente (inclut la dernière). */
  sessions: readonly ExerciseSession[];
  params: DoubleProgressionParams;
};

export type ProgressionOutcome =
  | {
      kind: 'load';
      direction: 'increase' | 'decrease';
      currentLoadKg: number;
      proposedLoadKg: number;
      justification: string;
    }
  | {
      kind: 'reps_target';
      currentLoadKg: number | null;
      currentMinReps: number;
      targetReps: number;
      hint: string;
      justification: string;
    };

/** Séries évaluées : les séries « de travail » (à défaut, toutes sauf l'échauffement). */
export function evaluatedSets(sets: readonly LoggedSet[]): LoggedSet[] {
  const working = sets.filter((s) => s.setType === 'working');
  return working.length > 0 ? working : sets.filter((s) => s.setType !== 'warmup');
}

/** Charge de travail d'une séance : la plus fréquente parmi les séries évaluées. */
export function sessionWorkingLoad(sets: readonly LoggedSet[]): number | null {
  const loads = evaluatedSets(sets)
    .map((s) => s.loadKg)
    .filter((l): l is number => l !== null);
  return mode(loads);
}

function rirLabel(target: number | null): string {
  return target === null ? '' : ` avec RIR ≥ ${formatNumber(target)}`;
}

export function evaluateDoubleProgression(input: ProgressionInput): ProgressionOutcome | null {
  const { prescription: p, sessions, params } = input;
  if (p.repsMin === null && p.repsMax === null) return null;
  const top = p.repsMax ?? p.repsMin ?? 0;
  const bottom = p.repsMin ?? p.repsMax ?? 0;
  const targetRir = targetRirOf(p);

  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const lastSets = evaluatedSets(last.sets);
  if (lastSets.length === 0) return null;
  const currentLoad = sessionWorkingLoad(last.sets) ?? p.loadKg;

  // Séance « en haut de fourchette » : toutes les séries validées, reps ≥ haut, RIR suffisant,
  // à la charge de travail actuelle (ou plus).
  const isAtTop = (s: ExerciseSession): boolean => {
    const sets = evaluatedSets(s.sets);
    return (
      sets.length > 0 &&
      sets.every((set) => {
        const rir = effectiveRir(set);
        return (
          set.completed &&
          (set.reps ?? 0) >= top &&
          (targetRir === null || rir === null || rir >= targetRir) &&
          (currentLoad === null || (set.loadKg ?? 0) >= currentLoad - 0.01)
        );
      })
    );
  };
  // Séance « sous la fourchette » : au moins la moitié des séries sous le bas de fourchette.
  const isBelow = (s: ExerciseSession): boolean => {
    const sets = evaluatedSets(s.sets);
    if (sets.length === 0) return false;
    const below = sets.filter((set) => (set.reps ?? 0) < bottom).length;
    return below * 2 >= sets.length;
  };

  const consecutive = (predicate: (s: ExerciseSession) => boolean): number => {
    let n = 0;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const s = sessions[i];
      if (!s || !predicate(s)) break;
      n++;
    }
    return n;
  };

  const range = formatRepRange(p.repsMin, p.repsMax);

  // 1. Hausse de charge
  const atTop = consecutive(isAtTop);
  if (input.loadable && atTop >= params.sessionsAtTopRequired) {
    const base = currentLoad ?? 0;
    const proposed = roundToStep(base + input.incrementKg, input.incrementKg);
    const when = atTop === 1 ? 'Dernière séance' : `${atTop} séances d’affilée`;
    return {
      kind: 'load',
      direction: 'increase',
      currentLoadKg: base,
      proposedLoadKg: proposed,
      justification:
        `${when} à ${top} reps ou plus sur toutes les séries de travail${rirLabel(targetRir)} ` +
        `→ +${formatKg(input.incrementKg)} proposé (${formatKg(base)} → ${formatKg(proposed)}).`,
    };
  }

  // 2. Sous la fourchette plusieurs séances de suite → baisse
  const below = consecutive(isBelow);
  if (
    input.loadable &&
    currentLoad !== null &&
    currentLoad > 0 &&
    below >= params.sessionsBelowRequired
  ) {
    let proposed = floorToStep(currentLoad * (1 - params.decreasePercent / 100), input.incrementKg);
    if (proposed > currentLoad - input.incrementKg) {
      proposed = floorToStep(currentLoad - input.incrementKg, input.incrementKg);
    }
    proposed = Math.max(0, proposed);
    const avgReps =
      lastSets.reduce((sum, s) => sum + (s.reps ?? 0), 0) / Math.max(1, lastSets.length);
    return {
      kind: 'load',
      direction: 'decrease',
      currentLoadKg: currentLoad,
      proposedLoadKg: proposed,
      justification:
        `${below} séances d’affilée sous le bas de la fourchette (${range} reps ; ` +
        `${formatNumber(avgReps, 1)} reps en moyenne à ${formatKg(currentLoad)}) ` +
        `→ baisse de ${formatNumber(params.decreasePercent, 1)} % proposée ` +
        `(${formatKg(currentLoad)} → ${formatKg(proposed)}). Garder la charge reste possible.`,
    };
  }

  // 3. Dans la fourchette → garder la charge et viser +1 rep
  const minReps = Math.min(...lastSets.map((s) => s.reps ?? 0));
  if (params.suggestRepTarget && minReps >= bottom && minReps < top) {
    const target = Math.min(top, minReps + 1);
    const loadText = currentLoad !== null && currentLoad > 0 ? ` à ${formatKg(currentLoad)}` : '';
    return {
      kind: 'reps_target',
      currentLoadKg: currentLoad,
      currentMinReps: minReps,
      targetReps: target,
      hint: repsTargetHint(target, currentLoad),
      justification:
        `Reps dans la fourchette (${range})${loadText} → garder la charge et viser +1 rep ` +
        `(${minReps} → ${target} sur la série la plus faible).`,
    };
  }
  return null;
}

/** Message affiché à l'adhérent pour un objectif de reps (« Objectif : 10 reps à 60 kg… »). */
export function repsTargetHint(reps: number, loadKg: number | null): string {
  const loadText = loadKg !== null && loadKg > 0 ? ` à ${formatKg(loadKg)}` : '';
  return `Objectif : ${reps} reps${loadText} sur chaque série.`;
}
