import { formatDuration } from '../format.ts';
import { mean } from '../units.ts';
import type { LoggedSet } from '../types.ts';
import type { RestTimeParams } from './rules.ts';

/**
 * §8.2 — Temps de repos réels très supérieurs aux temps prescrits, de façon répétée
 * → simple information au coach (aucune modification de programme).
 */

export type RestSession = { sessionId: string; date: string; sets: readonly LoggedSet[] };

export type RestOutcome = {
  sessionsConcerned: number;
  sessionsAnalyzed: number;
  avgActualSeconds: number;
  avgPrescribedSeconds: number;
  justification: string;
};

export function evaluateRestTime(
  sessions: readonly RestSession[],
  params: RestTimeParams,
): RestOutcome | null {
  const recent = sessions.slice(-params.lookbackSessions);
  let concerned = 0;
  const actuals: number[] = [];
  const prescribed: number[] = [];

  for (const s of recent) {
    const measured = s.sets.filter(
      (x) =>
        x.restSecondsActual !== null &&
        x.restSecondsActual !== undefined &&
        x.restSecondsPrescribed !== null &&
        x.restSecondsPrescribed !== undefined &&
        x.restSecondsPrescribed > 0,
    );
    if (measured.length === 0) continue;
    const long = measured.filter((x) => {
      const a = x.restSecondsActual as number;
      const p = x.restSecondsPrescribed as number;
      return a >= p * params.ratio && a - p >= params.minExtraSeconds;
    });
    if (long.length / measured.length >= params.minShare) {
      concerned++;
      for (const x of long) {
        actuals.push(x.restSecondsActual as number);
        prescribed.push(x.restSecondsPrescribed as number);
      }
    }
  }

  if (concerned < params.minSessions) return null;
  const avgA = mean(actuals) ?? 0;
  const avgP = mean(prescribed) ?? 0;
  return {
    sessionsConcerned: concerned,
    sessionsAnalyzed: recent.length,
    avgActualSeconds: Math.round(avgA),
    avgPrescribedSeconds: Math.round(avgP),
    justification:
      `Repos réels nettement plus longs que prévu sur ${concerned} des ${recent.length} dernières séances ` +
      `(${formatDuration(avgA)} en moyenne au lieu de ${formatDuration(avgP)}). Information uniquement.`,
  };
}
