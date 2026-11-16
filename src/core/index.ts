/**
 * Module « core » : logique métier pure (aucune dépendance à React, Expo ou Supabase).
 * Utilisé par l'app ET par les Edge Functions. Tout est testé dans __tests__.
 */
export * from './format.ts';
export * from './units.ts';
export * from './types.ts';
export * from './metrics/strength.ts';
export * from './metrics/records.ts';
export * from './metrics/schedule.ts';
export * from './metrics/weightTrend.ts';
export * from './algorithms/rules.ts';
export * from './algorithms/doubleProgression.ts';
export * from './algorithms/stagnation.ts';
export * from './algorithms/fatigue.ts';
export * from './algorithms/restTime.ts';
export * from './algorithms/engine.ts';
export * from './session/plan.ts';
export * from './session/summary.ts';
export * from './dates.ts';
export * from './notifications/pushGrouping.ts';
export * from './youtube.ts';
export * from './adherents.ts';
