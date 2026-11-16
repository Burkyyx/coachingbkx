import { formatKg, formatRepRange } from '../format.ts';
import { best1RM, countedSets } from '../metrics/strength.ts';
import type { ExerciseSession, Prescription } from '../types.ts';
import type { StagnationParams } from './rules.ts';

/**
 * §8.2 — Stagnation : aucune progression (charge ou reps) sur un exercice pendant
 * N séances → alerte + suggestion (variante, changement de fourchette ou décharge).
 *
 * « Progresser » = soulever une charge plus lourde qu'avant, OU faire plus de
 * répétitions à la meilleure charge. (Le 1RM estimé n'est PAS utilisé ici : après
 * une hausse de charge, les reps baissent normalement et le 1RM estimé recule
 * quelques séances — ce n'est pas une stagnation.)
 * Pour les exercices sans charge, seules les répétitions comptent.
 */

export type StagnationInput = {
  exerciseName: string;
  sessions: readonly ExerciseSession[];
  prescription: Prescription | null;
  alternatives: readonly { id: string; name: string }[];
  params: StagnationParams;
};

export type StagnationOutcome = {
  alertMessage: string;
  action:
    | { kind: 'variation'; exerciseId: string; exerciseName: string }
    | { kind: 'rep_range'; repsMin: number; repsMax: number }
    | { kind: 'deload' };
  justification: string;
  bestBefore: { load: number; reps: number };
  unit: 'kg' | 'reps';
};

/** Meilleure performance d'une séance : charge la plus lourde et reps faites à cette charge. */
type Perf = { load: number; reps: number };

function sessionPerf(s: ExerciseSession): Perf | null {
  const sets = countedSets(s.sets).filter((x) => (x.reps ?? 0) > 0);
  if (sets.length === 0) return null;
  const load = Math.max(...sets.map((x) => x.loadKg ?? 0));
  const reps = Math.max(...sets.filter((x) => (x.loadKg ?? 0) === load).map((x) => x.reps ?? 0));
  return { load, reps };
}

/** Vrai si `p` fait mieux que `best` (plus lourd, ou plus de reps à la même charge). */
function beats(p: Perf, best: Perf, minImprovementPercent: number): boolean {
  if (p.load > best.load * (1 + minImprovementPercent / 100) && p.load > best.load) return true;
  return p.load >= best.load && p.reps > best.reps;
}

function better(a: Perf, b: Perf): Perf {
  return a.load > b.load || (a.load === b.load && a.reps > b.reps) ? a : b;
}

/** Nouvelle fourchette proposée en cas de stagnation (ex. 8–12 → 5–8 ; 3–5 → 8–12). */
export function proposeRepRange(min: number, max: number): { repsMin: number; repsMax: number } {
  if (max <= 6) return { repsMin: 8, repsMax: 12 };
  const newMin = Math.max(3, Math.round(min * 0.6));
  const newMax = Math.max(newMin + 2, min);
  return { repsMin: newMin, repsMax: newMax };
}

export function evaluateStagnation(input: StagnationInput): StagnationOutcome | null {
  const { sessions, params } = input;
  const window = params.sessions;
  if (sessions.length < window + 1) return null;

  const perfs = sessions.map(sessionPerf);
  const before = perfs.slice(0, sessions.length - window).filter((x): x is Perf => x !== null);
  const recent = perfs.slice(sessions.length - window);
  if (before.length === 0 || recent.some((x) => x === null)) return null;

  // Chaque séance récente est comparée au meilleur niveau atteint avant elle.
  let best = before.reduce(better);
  const bestBefore = best;
  for (const perf of recent as Perf[]) {
    if (beats(perf, best, params.minImprovementPercent)) return null;
    best = better(perf, best);
  }

  const unit: 'kg' | 'reps' = bestBefore.load > 0 ? 'kg' : 'reps';
  const bestText =
    unit === 'kg'
      ? `meilleure performance ${formatKg(bestBefore.load)} × ${bestBefore.reps}`
      : `${bestBefore.reps} reps max`;
  const alertMessage = `Stagnation sur ${input.exerciseName} : aucune progression depuis ${window} séances (${bestText}).`;

  // Choix de l'action
  let preferred = params.preferredAction;
  const alt = input.alternatives[0];
  const p = input.prescription;
  if (preferred === 'variation' && !alt) preferred = 'rep_range';
  if (preferred === 'rep_range' && (!p || p.repsMin === null || p.repsMax === null))
    preferred = 'deload';

  const prefix = `Aucune progression sur ${input.exerciseName} depuis ${window} séances (${bestText})`;
  if (preferred === 'variation' && alt) {
    return {
      alertMessage,
      action: { kind: 'variation', exerciseId: alt.id, exerciseName: alt.name },
      justification: `${prefix} → variante proposée : ${alt.name}.`,
      bestBefore,
      unit,
    };
  }
  if (preferred === 'rep_range' && p && p.repsMin !== null && p.repsMax !== null) {
    const next = proposeRepRange(p.repsMin, p.repsMax);
    return {
      alertMessage,
      action: { kind: 'rep_range', ...next },
      justification:
        `${prefix} → changer de fourchette : ${formatRepRange(p.repsMin, p.repsMax)} → ` +
        `${formatRepRange(next.repsMin, next.repsMax)} reps.`,
      bestBefore,
      unit,
    };
  }
  return {
    alertMessage,
    action: { kind: 'deload' },
    justification: `${prefix} → semaine de décharge proposée pour relancer la progression.`,
    bestBefore,
    unit,
  };
}

/** Variation (%) du dernier 1RM estimé par rapport au meilleur des séances précédentes. */
export function lastSessionChangePercent(
  sessions: readonly ExerciseSession[],
  lookback: number,
): number | null {
  if (sessions.length < 2) return null;
  const last = sessions[sessions.length - 1];
  const previous = sessions.slice(Math.max(0, sessions.length - 1 - lookback), sessions.length - 1);
  if (!last) return null;
  const lastScore = best1RM(last.sets);
  const prevScores = previous.map((s) => best1RM(s.sets)).filter((v): v is number => v !== null);
  if (lastScore === null || prevScores.length === 0) return null;
  const best = Math.max(...prevScores);
  return Math.round(((lastScore - best) / best) * 1000) / 10;
}
