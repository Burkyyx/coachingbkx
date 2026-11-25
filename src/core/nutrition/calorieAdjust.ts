/**
 * Ajustement des calories selon l'évolution du poids, et détection
 * « déficit + performances en baisse ». TypeScript pur, testé.
 *
 * L'algorithme PROPOSE : le coach valide (ou modifie / refuse) chaque ajustement.
 */

import { formatInt, formatSigned } from '../format.ts';
import { addDays, daysBetween } from '../metrics/schedule.ts';
import type { WeightPoint } from '../metrics/weightTrend.ts';
import { ABSOLUTE_FLOOR_KCAL, type Goal } from './energy.ts';
import type { Macros } from './journal.ts';

/** Vitesse visée par défaut (% du poids par semaine) selon l'objectif. */
export const DEFAULT_WEEKLY_RATE: Record<Goal, number> = {
  fat_loss: -0.5,
  muscle_gain: 0.25,
  recomposition: 0,
  performance: 0,
  health: 0,
};

/** Écart toléré avant de proposer un ajustement (% / semaine). */
export const RATE_TOLERANCE = 0.25;
/** Perte maximale acceptée (% du poids / semaine). */
export const MAX_WEEKLY_LOSS = -1;
/** Fenêtre d'observation du poids (jours). */
export const OBSERVATION_DAYS = 21;

export type CalorieTargets = Macros & {
  floorKcal: number | null;
  /** Vitesse visée réglée par le coach (% / semaine), sinon celle de l'objectif. */
  weeklyRateTarget: number | null;
};

export type CalorieSuggestion = {
  deltaKcal: number;
  current: Macros;
  proposed: Macros;
  /** Vitesse réelle et visée (% du poids / semaine). */
  actualRate: number;
  targetRate: number;
  reason: 'too_fast_loss' | 'below_target' | 'above_target';
  justification: string;
};

/**
 * Vitesse d'évolution du poids (% / semaine) sur la fenêtre d'observation, ou null si les
 * données sont insuffisantes : au moins 5 pesées sur au moins 14 jours, dont une récente.
 */
export function observedWeeklyRate(weights: readonly WeightPoint[], today: string): number | null {
  const from = addDays(today, -OBSERVATION_DAYS);
  const recent = weights.filter((w) => w.date >= from && w.date <= today);
  if (recent.length < 5) return null;
  const sorted = [...recent].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return null;
  if (daysBetween(first.date, last.date) < 14 || daysBetween(last.date, today) > 7) return null;
  // Régression linéaire sur les pesées brutes de la fenêtre : lisse les variations
  // quotidiennes (eau, sel…) sans le retard d'une moyenne mobile.
  const xs = sorted.map((w) => daysBetween(first.date, w.date));
  const ys = sorted.map((w) => w.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += ((xs[i] ?? 0) - mx) * ((ys[i] ?? 0) - my);
    den += ((xs[i] ?? 0) - mx) ** 2;
  }
  if (den === 0 || my <= 0) return null;
  return Math.round(((num / den) * 7 * 100 * 100) / my) / 100;
}

/** Nouvelles macros pour un nouvel apport : seuls les glucides absorbent la différence. */
export function adjustMacrosForKcal(current: Macros, newKcal: number): Macros {
  let carbs = current.carbsG + (newKcal - current.kcal) / 4;
  let fat = current.fatG;
  if (carbs < 0) {
    fat = Math.max(0, fat + (carbs * 4) / 9);
    carbs = 0;
  }
  return {
    kcal: newKcal,
    proteinG: current.proteinG,
    carbsG: Math.round(carbs),
    fatG: Math.round(fat),
  };
}

/**
 * Proposition d'ajustement (±100 à 150 kcal), ou null si le poids évolue comme prévu,
 * si les données manquent ou si le plancher empêche de baisser.
 */
export function suggestCalorieAdjustment(input: {
  weights: readonly WeightPoint[];
  today: string;
  targets: CalorieTargets;
  goal: Goal | null;
}): CalorieSuggestion | null {
  const { targets } = input;
  if (!targets.kcal || targets.kcal <= 0) return null;
  const actualRate = observedWeeklyRate(input.weights, input.today);
  if (actualRate === null) return null;
  const targetRate = targets.weeklyRateTarget ?? (input.goal ? DEFAULT_WEEKLY_RATE[input.goal] : 0);

  const diff = actualRate - targetRate;
  let delta = 0;
  let reason: CalorieSuggestion['reason'];
  if (actualRate < MAX_WEEKLY_LOSS) {
    delta = 150;
    reason = 'too_fast_loss';
  } else if (diff < -RATE_TOLERANCE) {
    delta = Math.abs(diff) >= 0.5 ? 150 : 100;
    reason = 'below_target';
  } else if (diff > RATE_TOLERANCE) {
    delta = -(diff >= 0.5 ? 150 : 100);
    reason = 'above_target';
  } else {
    return null;
  }

  const floor = Math.max(targets.floorKcal ?? 0, ABSOLUTE_FLOOR_KCAL);
  let newKcal = Math.round((targets.kcal + delta) / 10) * 10;
  if (delta < 0 && newKcal < floor) newKcal = floor;
  if (delta < 0 && newKcal >= targets.kcal) return null; // déjà au plancher
  const current: Macros = {
    kcal: targets.kcal,
    proteinG: targets.proteinG,
    carbsG: targets.carbsG,
    fatG: targets.fatG,
  };
  const proposed = adjustMacrosForKcal(current, newKcal);
  const deltaKcal = newKcal - targets.kcal;

  const rate = (r: number) => `${formatSigned(r, 2)} %/sem.`;
  const why =
    reason === 'too_fast_loss'
      ? `perte trop rapide (plus de 1 % du poids par semaine)`
      : reason === 'below_target'
        ? `poids en dessous de la trajectoire visée (${rate(targetRate)})`
        : `poids au-dessus de la trajectoire visée (${rate(targetRate)})`;
  const justification =
    `Poids : ${rate(actualRate)} sur 3 semaines, ${why} → ` +
    `${deltaKcal > 0 ? '+' : '−'}${formatInt(Math.abs(deltaKcal))} kcal ` +
    `(${formatInt(targets.kcal)} → ${formatInt(newKcal)} kcal, glucides ` +
    `${formatInt(targets.carbsG)} → ${formatInt(proposed.carbsG)} g).`;

  return { deltaKcal, current, proposed, actualRate, targetRate, reason, justification };
}

// ---------------------------------------------------------------------------
// Déficit + performances en baisse
// ---------------------------------------------------------------------------

/** Meilleur 1RM estimé d'un exercice lors d'une séance. */
export type StrengthEntry = { date: string; exerciseId: string; best1RM: number };

export type PerformanceTrend = {
  comparedExercises: number;
  droppedExercises: number;
  /** Variation moyenne du 1RM estimé (%), 14 derniers jours vs 4 semaines précédentes. */
  averageChangePct: number;
};

/** Seuil de baisse d'un exercice (%). */
export const PERFORMANCE_DROP_PCT = -5;

/**
 * Compare la force récente (14 derniers jours) à la période de référence (jours 15 à 42),
 * exercice par exercice (moyenne des meilleurs 1RM estimés de chaque séance).
 */
export function performanceTrend(
  entries: readonly StrengthEntry[],
  today: string,
): PerformanceTrend | null {
  const recentFrom = addDays(today, -14);
  const baseFrom = addDays(today, -42);
  const byExercise = new Map<string, { recent: number[]; base: number[] }>();
  for (const e of entries) {
    if (e.date > today || e.date < baseFrom || !(e.best1RM > 0)) continue;
    const slot = byExercise.get(e.exerciseId) ?? { recent: [], base: [] };
    (e.date > recentFrom ? slot.recent : slot.base).push(e.best1RM);
    byExercise.set(e.exerciseId, slot);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const changes: number[] = [];
  for (const { recent, base } of byExercise.values()) {
    if (recent.length === 0 || base.length === 0) continue;
    changes.push(((mean(recent) - mean(base)) / mean(base)) * 100);
  }
  if (changes.length < 2) return null;
  return {
    comparedExercises: changes.length,
    droppedExercises: changes.filter((c) => c <= PERFORMANCE_DROP_PCT).length,
    averageChangePct: Math.round(mean(changes) * 10) / 10,
  };
}

/** Seuil de perte de poids considérée comme un déficit (% / semaine). */
export const DEFICIT_RATE = -0.25;

/**
 * Alerte quand l'adhérent perd du poids ET que sa force recule : signal possible d'un
 * déficit trop important (récupération). Renvoie le message pour le coach, ou null.
 */
export function deficitPerformanceAlert(
  weeklyRate: number | null,
  perf: PerformanceTrend | null,
): string | null {
  if (weeklyRate === null || perf === null || weeklyRate > DEFICIT_RATE) return null;
  const declining = perf.droppedExercises >= 2 || perf.averageChangePct <= PERFORMANCE_DROP_PCT;
  if (!declining) return null;
  return (
    `Poids ${formatSigned(weeklyRate, 2)} %/sem. et force en baisse ` +
    `(${perf.droppedExercises}/${perf.comparedExercises} exercices en recul, ` +
    `${formatSigned(perf.averageChangePct, 1)} % en moyenne sur 14 jours) : ` +
    `déficit peut-être trop important.`
  );
}

/** Pour l'affichage : « 2 300 kcal → 2 200 kcal ». */
export function formatKcalChange(from: number, to: number): string {
  return `${formatInt(from)} → ${formatInt(to)} kcal (${formatSigned(to - from, 0)})`;
}
