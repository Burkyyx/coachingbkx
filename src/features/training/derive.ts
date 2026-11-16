import { weekStart, workoutDate, type ExerciseSession, type LoggedSet } from '@/core';
import type { WorkoutNode } from '@/features/programs/api';

import type { AdherentBundle, HistorySet } from './bundle';

/**
 * Calculs à partir de la copie locale (fonctions pures, testées).
 */

export type ScheduledWorkout = WorkoutNode & {
  date: string;
  done: boolean;
  /** Identifiant de la séance réalisée, si faite. */
  sessionId: string | null;
};

/** Toutes les séances du programme avec leur date et leur statut (faite ou non). */
export function scheduledWorkouts(bundle: AdherentBundle): ScheduledWorkout[] {
  const start = bundle.program?.start_date;
  if (!start) return [];
  const doneByWorkout = new Map<string, string>();
  for (const s of bundle.sessions) {
    if (s.status === 'completed' && s.workout_id) doneByWorkout.set(s.workout_id, s.id);
  }
  return bundle.workouts
    .map((w) => ({
      ...w,
      date: workoutDate(start, w.week_index, w.day_of_week),
      done: doneByWorkout.has(w.id),
      sessionId: doneByWorkout.get(w.id) ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position);
}

/**
 * Séance à proposer aujourd'hui :
 *  1. celle prévue aujourd'hui (non faite) ;
 *  2. sinon une séance manquée de la semaine en cours (encore rattrapable) ;
 *  3. sinon la prochaine à venir.
 */
export function suggestedWorkout(
  schedule: readonly ScheduledWorkout[],
  today: string,
): { workout: ScheduledWorkout; when: 'today' | 'late' | 'upcoming' } | null {
  const todays = schedule.find((w) => w.date === today && !w.done);
  if (todays) return { workout: todays, when: 'today' };
  const monday = weekStart(today);
  const lateThisWeek = schedule.find((w) => !w.done && w.date < today && w.date >= monday);
  if (lateThisWeek) return { workout: lateThisWeek, when: 'late' };
  const upcoming = schedule.find((w) => !w.done && w.date > today);
  return upcoming ? { workout: upcoming, when: 'upcoming' } : null;
}

export function toLoggedSet(s: HistorySet): LoggedSet {
  return {
    id: s.id,
    setType: s.set_type,
    loadKg: s.load_kg === null ? null : Number(s.load_kg),
    reps: s.reps,
    rir: s.rir === null ? null : Number(s.rir),
    rpe: s.rpe === null ? null : Number(s.rpe),
    completed: s.completed,
    restSecondsActual: s.rest_seconds_actual,
    restSecondsPrescribed: s.rest_seconds_prescribed,
  };
}

/** Historique d'un exercice (séances terminées, de la plus ancienne à la plus récente). */
export function exerciseHistory(
  bundle: AdherentBundle,
  exerciseId: string,
  excludeSessionId?: string,
): ExerciseSession[] {
  const completed = new Map(
    bundle.sessions
      .filter((s) => s.status === 'completed' && s.id !== excludeSessionId)
      .map((s) => [s.id, s]),
  );
  const bySession = new Map<string, HistorySet[]>();
  for (const set of bundle.sets) {
    if (set.exercise_id !== exerciseId || !completed.has(set.session_log_id)) continue;
    bySession.set(set.session_log_id, [...(bySession.get(set.session_log_id) ?? []), set]);
  }
  return [...bySession.entries()]
    .map(([sessionId, sets]) => ({
      sessionId,
      date: completed.get(sessionId)?.started_at ?? sets[0]?.performed_at ?? '',
      sets: sets.sort((a, b) => a.position - b.position).map(toLoggedSet),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Dernière performance pour une série donnée (même position, sinon dernière série de travail). */
export function lastPerformance(
  history: readonly ExerciseSession[],
  position: number,
): LoggedSet | null {
  const last = history[history.length - 1];
  if (!last) return null;
  const working = last.sets.filter((s) => s.setType !== 'warmup' && s.completed);
  return working[position] ?? working[working.length - 1] ?? null;
}
