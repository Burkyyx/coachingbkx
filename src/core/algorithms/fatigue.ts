import { formatNumber } from '../format.ts';
import { mean } from '../units.ts';
import { effectiveRir, type LoggedSet } from '../types.ts';
import type { FatigueParams } from './rules.ts';

/**
 * §8.2 — Fatigue : combinaison de signaux
 *  1. ressenti de séance élevé (1–10) ;
 *  2. RIR réel nettement inférieur à la cible ;
 *  3. baisse de performance sur plusieurs exercices ;
 *  4. bilan hebdo avec sommeil ou énergie bas.
 * À partir de `minSignals` signaux simultanés → suggestion de semaine de décharge.
 */

export type FatigueSession = {
  sessionId: string;
  date: string;
  /** Ressenti global 1 (très facile) – 10 (épuisant). */
  rating: number | null;
  sets: readonly (LoggedSet & { targetRir: number | null })[];
};

export type FatigueInput = {
  /** Séances récentes (de la plus ancienne à la plus récente). */
  sessions: readonly FatigueSession[];
  /** Variation (%) de performance par exercice lors de la dernière séance (négatif = baisse). */
  performanceChanges: readonly number[];
  latestCheckin: { sleep: number | null; energy: number | null } | null;
  params: FatigueParams;
};

export type FatigueOutcome = {
  signals: string[];
  volumeFactor: number;
  justification: string;
};

/** Écarts (RIR cible − RIR réel) des séries de travail validées. */
export function rirDeficits(sets: FatigueSession['sets']): number[] {
  return sets
    .filter((s) => s.setType !== 'warmup' && s.completed && s.targetRir !== null)
    .map((s) => {
      const actual = effectiveRir(s);
      return actual === null ? null : (s.targetRir as number) - actual;
    })
    .filter((d): d is number => d !== null);
}

export function evaluateFatigue(input: FatigueInput): FatigueOutcome | null {
  const { params } = input;
  const recent = input.sessions.slice(-params.lookbackSessions);
  const signals: string[] = [];

  // 1. Ressenti élevé
  const ratings = recent.map((s) => s.rating).filter((r): r is number => r !== null);
  const avgRating = mean(ratings);
  if (ratings.length >= 2 && avgRating !== null && avgRating >= params.ratingThreshold) {
    signals.push(
      `ressenti moyen ${formatNumber(avgRating, 1)}/10 sur les ${ratings.length} dernières séances`,
    );
  }

  // 2. RIR réel inférieur à la cible
  const deficits = recent.flatMap((s) => rirDeficits(s.sets));
  const avgDeficit = mean(deficits);
  if (deficits.length >= 3 && avgDeficit !== null && avgDeficit >= params.rirDeficit) {
    signals.push(`RIR réel inférieur à la cible de ${formatNumber(avgDeficit, 1)} en moyenne`);
  }

  // 3. Baisse de performance (au moins la moitié des exercices, et au moins un)
  const changes = input.performanceChanges;
  const drops = changes.filter((c) => c <= -params.performanceDropPercent);
  if (changes.length > 0 && drops.length > 0 && drops.length * 2 >= changes.length) {
    signals.push(
      `performance en baisse sur ${drops.length} exercice${drops.length > 1 ? 's' : ''} sur ${changes.length}`,
    );
  }

  // 4. Bilan : sommeil / énergie bas
  const c = input.latestCheckin;
  if (c) {
    const low: string[] = [];
    if (c.sleep !== null && c.sleep <= params.lowWellbeing) low.push(`sommeil ${c.sleep}/5`);
    if (c.energy !== null && c.energy <= params.lowWellbeing) low.push(`énergie ${c.energy}/5`);
    if (low.length) signals.push(`${low.join(' et ')} au dernier bilan`);
  }

  if (signals.length < params.minSignals) return null;
  const reduction = Math.round((1 - params.volumeFactor) * 100);
  return {
    signals,
    volumeFactor: params.volumeFactor,
    justification: `Signes de fatigue : ${signals.join(' ; ')} → semaine de décharge proposée (volume −${reduction} %).`,
  };
}
