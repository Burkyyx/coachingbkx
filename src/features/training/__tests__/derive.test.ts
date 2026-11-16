import type { WorkoutNode } from '@/features/programs/api';

import {
  mergeLocalSessions,
  type AdherentBundle,
  type HistorySession,
  type HistorySet,
} from '../bundle';
import { exerciseHistory, lastPerformance, scheduledWorkouts, suggestedWorkout } from '../derive';

function workout(id: string, week: number, day: number): WorkoutNode {
  return {
    id,
    program_id: 'p',
    week_index: week,
    day_of_week: day,
    name: id,
    position: 0,
    notes: null,
    created_at: '',
    updated_at: '',
    exercises: [],
  };
}

function session(
  id: string,
  workoutId: string | null,
  startedAt: string,
  status: HistorySession['status'] = 'completed',
): HistorySession {
  return {
    id,
    workout_id: workoutId,
    program_id: 'p',
    scheduled_date: null,
    started_at: startedAt,
    ended_at: null,
    status,
    rating: null,
    duration_seconds: null,
  };
}

function setLog(
  id: string,
  sessionId: string,
  exerciseId: string,
  position: number,
  load: number,
  reps: number,
): HistorySet {
  return {
    id,
    session_log_id: sessionId,
    exercise_id: exerciseId,
    workout_exercise_id: null,
    position,
    set_type: 'working',
    load_kg: load,
    reps,
    rir: null,
    rpe: null,
    completed: true,
    performed_at: `2026-11-1${position}T10:00:00Z`,
    rest_seconds_actual: null,
    rest_seconds_prescribed: null,
    duration_seconds: null,
  };
}

function bundle(over: Partial<AdherentBundle> = {}): AdherentBundle {
  return {
    fetchedAt: '',
    effortScale: 'rir',
    // Début lundi 16 novembre 2026 : lundi / mercredi / vendredi.
    program: { id: 'p', start_date: '2026-11-16' } as AdherentBundle['program'],
    workouts: [workout('A', 1, 1), workout('B', 1, 3), workout('C', 1, 5), workout('D', 2, 1)],
    adjustments: [],
    exercises: [],
    alternatives: {},
    reference1rm: {},
    sessions: [],
    sets: [],
    ...over,
  };
}

describe('calendrier de l’adhérent', () => {
  it('date et statut de chaque séance', () => {
    const s = scheduledWorkouts(bundle({ sessions: [session('s1', 'A', '2026-11-16T18:00:00Z')] }));
    expect(s.map((w) => [w.id, w.date, w.done])).toEqual([
      ['A', '2026-11-16', true],
      ['B', '2026-11-18', false],
      ['C', '2026-11-20', false],
      ['D', '2026-11-23', false],
    ]);
    expect(scheduledWorkouts(bundle({ program: null }))).toEqual([]);
  });
  it('propose la séance du jour, une séance manquée de la semaine, ou la prochaine', () => {
    const sched = scheduledWorkouts(bundle());
    // Mardi : la séance de lundi a été manquée → proposée en rattrapage.
    expect(suggestedWorkout(sched, '2026-11-17')).toMatchObject({
      workout: { id: 'A' },
      when: 'late',
    });
    // Mercredi : la séance du jour passe avant le rattrapage.
    expect(suggestedWorkout(sched, '2026-11-18')).toMatchObject({
      workout: { id: 'B' },
      when: 'today',
    });
    const afterA = scheduledWorkouts(
      bundle({ sessions: [session('s1', 'A', '2026-11-16T18:00:00Z')] }),
    );
    expect(suggestedWorkout(afterA, '2026-11-18')).toMatchObject({
      workout: { id: 'B' },
      when: 'today',
    });
    expect(suggestedWorkout(afterA, '2026-11-17')).toMatchObject({
      workout: { id: 'B' },
      when: 'upcoming',
    });
    // Dimanche : la séance manquée de la semaine est encore proposée.
    expect(suggestedWorkout(afterA, '2026-11-22')).toMatchObject({
      workout: { id: 'B' },
      when: 'late',
    });
    // Lundi suivant : les séances manquées de la semaine 1 ne sont plus proposées.
    expect(suggestedWorkout(afterA, '2026-11-23')).toMatchObject({
      workout: { id: 'D' },
      when: 'today',
    });
    expect(suggestedWorkout(afterA, '2026-12-30')).toBeNull();
  });
  it('les séances en cours (non terminées) ne comptent pas comme faites', () => {
    const s = scheduledWorkouts(
      bundle({ sessions: [session('s1', 'A', '2026-11-16T18:00:00Z', 'in_progress')] }),
    );
    expect(s[0]?.done).toBe(false);
  });
});

describe('historique par exercice', () => {
  const b = bundle({
    sessions: [
      session('s1', 'A', '2026-11-09T10:00:00Z'),
      session('s2', 'A', '2026-11-16T10:00:00Z'),
      session('s3', 'B', '2026-11-18T10:00:00Z', 'abandoned'),
    ],
    sets: [
      setLog('a', 's1', 'squat', 0, 80, 8),
      setLog('b', 's2', 'squat', 1, 82.5, 7),
      setLog('c', 's2', 'squat', 0, 82.5, 8),
      setLog('d', 's2', 'bench', 0, 60, 10),
      setLog('e', 's3', 'squat', 0, 100, 1),
    ],
  });
  it('regroupe par séance terminée, dans l’ordre', () => {
    const h = exerciseHistory(b, 'squat');
    expect(h.map((x) => x.sessionId)).toEqual(['s1', 's2']);
    expect(h[1]?.sets.map((x) => x.reps)).toEqual([8, 7]);
    expect(exerciseHistory(b, 'squat', 's2').map((x) => x.sessionId)).toEqual(['s1']);
  });
  it('donne la dernière performance pour une position de série', () => {
    const h = exerciseHistory(b, 'squat');
    expect(lastPerformance(h, 1)).toMatchObject({ loadKg: 82.5, reps: 7 });
    expect(lastPerformance(h, 5)).toMatchObject({ reps: 7 });
    expect(lastPerformance([], 0)).toBeNull();
  });
  it('fusionne les séances enregistrées sur l’appareil (hors-ligne)', () => {
    const merged = mergeLocalSessions(b, [
      {
        session: session('s1', 'A', '2026-11-09T10:00:00Z'),
        sets: [setLog('a', 's1', 'squat', 0, 80, 8)],
      },
      {
        session: session('s9', 'C', '2026-11-20T10:00:00Z'),
        sets: [setLog('z', 's9', 'squat', 0, 85, 6)],
      },
    ]);
    expect(merged.sessions.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's9']);
    expect(merged.sets.filter((s) => s.id === 'a')).toHaveLength(1);
    expect(exerciseHistory(merged, 'squat').map((x) => x.sessionId)).toEqual(['s1', 's2', 's9']);
  });
});
