import { formatKg, formatRepRange } from '../format.ts';
import { best1RM, countedSets } from '../metrics/strength.ts';
import type { ExerciseSession, Prescription } from '../types.ts';
import type { StagnationParams } from './rules.ts';

/**
 * §8.2 — Stagnation : aucune progression (charge ou reps) sur un exercice pendant
 * N séances → alerte + suggestion (variante, changement de fourchette ou décharge).
 *
 * La performance d'une séance est mesurée par le meilleur 1RM estimé (Epley), qui
 * augmente quand la charge OU les répétitions augmentent. Pour les exercices sans
 * charge, on utilise le nombre maximal de répétitions.
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
  bestBefore: number;
  unit: 'kg' | 'reps';
};

function sessionScore(s: ExerciseSession): { value: number; unit: 'kg' | 'reps' } | null {
  const e1rm = best1RM(s.sets);
  if (e1rm !== null) return { value: e1rm, unit: 'kg' };
  const reps = countedSets(s.sets).map((x) => x.reps ?? 0);
  return reps.length ? { value: Math.max(...reps), unit: 'reps' } : null;
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

  const scored = sessions.map(sessionScore);
  const before = scored.slice(0, sessions.length - window).filter((s) => s !== null);
  const recent = scored.slice(sessions.length - window);
  if (before.length === 0 || recent.some((s) => s === null)) return null;

  const unit = before[0]!.unit;
  if (recent.some((s) => s!.unit !== unit) || before.some((s) => s.unit !== unit)) return null;

  const bestBefore = Math.max(...before.map((s) => s.value));
  const threshold = bestBefore * (1 + params.minImprovementPercent / 100);
  const progressed = recent.some((s) => s!.value > threshold);
  if (progressed) return null;

  const bestText =
    unit === 'kg'
      ? `meilleur 1RM estimé ${formatKg(Math.round(bestBefore * 10) / 10)}`
      : `${bestBefore} reps max`;
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
