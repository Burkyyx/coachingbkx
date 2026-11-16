import type { PrescribedSet, WorkoutNode } from '@/features/programs/api';

import type { AdherentBundle } from '../bundle';
import type { ScheduledWorkout } from '../derive';
import {
  addSet,
  adjustRest,
  buildSession,
  endRest,
  finishSession,
  nextPosition,
  recordId,
  replaceExercise,
  updateSet,
  validateSet,
} from '../session/engine';

let n = 0;
const makeId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const T0 = Date.parse('2026-11-18T18:00:00Z');

function ps(id: string, position: number, over: Partial<PrescribedSet> = {}): PrescribedSet {
  return {
    id,
    workout_exercise_id: 'we',
    program_id: 'p',
    position,
    set_type: 'working',
    reps_min: 8,
    reps_max: 12,
    load_kg: 60,
    load_pct_1rm: null,
    target_rir: 2,
    target_rpe: null,
    rest_seconds: 90,
    tempo: null,
    duration_seconds: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

function workout(
  exercises: { id: string; exercise: string; group?: string; sets: PrescribedSet[] }[],
): ScheduledWorkout {
  const w: WorkoutNode = {
    id: 'w1',
    program_id: 'p',
    week_index: 1,
    day_of_week: 3,
    name: 'Push A',
    position: 0,
    notes: null,
    created_at: '',
    updated_at: '',
    exercises: exercises.map((e, i) => ({
      id: e.id,
      workout_id: 'w1',
      program_id: 'p',
      exercise_id: e.exercise,
      position: i,
      superset_group: e.group ?? null,
      coach_notes: null,
      alternative_exercise_ids: [],
      next_session_hint: null,
      created_at: '',
      updated_at: '',
      sets: e.sets,
    })),
  };
  return { ...w, date: '2026-11-18', done: false, sessionId: null };
}

function bundle(over: Partial<AdherentBundle> = {}): AdherentBundle {
  return {
    fetchedAt: '',
    effortScale: 'rir',
    program: { id: 'p', start_date: '2026-11-16' } as AdherentBundle['program'],
    workouts: [],
    adjustments: [],
    exercises: [
      {
        id: 'bench',
        name: 'Développé couché',
        primary_muscle: 'chest',
        equipment: 'barbell',
        type: 'free_weight',
        load_increment_kg: 2.5,
        instructions: null,
        video_path: null,
        video_url: null,
        image_path: null,
      },
      {
        id: 'db',
        name: 'Développé haltères',
        primary_muscle: 'chest',
        equipment: 'dumbbell',
        type: 'free_weight',
        load_increment_kg: 2,
        instructions: null,
        video_path: null,
        video_url: null,
        image_path: null,
      },
      {
        id: 'row',
        name: 'Rowing',
        primary_muscle: 'back',
        equipment: 'barbell',
        type: 'free_weight',
        load_increment_kg: 2.5,
        instructions: null,
        video_path: null,
        video_url: null,
        image_path: null,
      },
    ],
    alternatives: {},
    reference1rm: {},
    // Historique : séance précédente au développé couché, 60 kg × 10 / 9.
    sessions: [
      {
        id: 'old',
        workout_id: 'w0',
        program_id: 'p',
        scheduled_date: null,
        started_at: '2026-11-16T18:00:00Z',
        ended_at: null,
        status: 'completed',
        rating: 7,
        duration_seconds: 3000,
      },
    ],
    sets: [
      {
        id: 'h1',
        session_log_id: 'old',
        exercise_id: 'bench',
        workout_exercise_id: null,
        position: 0,
        set_type: 'working',
        load_kg: 60,
        reps: 10,
        rir: 2,
        rpe: null,
        completed: true,
        performed_at: '2026-11-16T18:10:00Z',
        rest_seconds_actual: null,
        rest_seconds_prescribed: null,
        duration_seconds: null,
      },
      {
        id: 'h2',
        session_log_id: 'old',
        exercise_id: 'bench',
        workout_exercise_id: null,
        position: 1,
        set_type: 'working',
        load_kg: 60,
        reps: 9,
        rir: 1,
        rpe: null,
        completed: true,
        performed_at: '2026-11-16T18:13:00Z',
        rest_seconds_actual: null,
        rest_seconds_prescribed: null,
        duration_seconds: null,
      },
    ],
    ...over,
  };
}

const ctx = (now = T0) => ({ now, makeId });

describe('mode séance', () => {
  it('prépare la séance avec les valeurs pré-remplies et ouvre la séance côté serveur', () => {
    const { session, ops } = buildSession({
      bundle: bundle(),
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0), ps('b', 1)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    expect(session.exercises[0]?.sets.map((s) => [s.loadKg, s.reps])).toEqual([
      [60, 10],
      [60, 9],
    ]);
    expect(ops).toEqual([
      expect.objectContaining({
        table: 'session_logs',
        payload: expect.objectContaining({
          adherent_id: 'u1',
          workout_id: 'w1',
          status: 'in_progress',
          scheduled_date: '2026-11-18',
        }),
      }),
    ]);
  });

  it('applique une semaine de décharge et le % du 1RM', () => {
    const b = bundle({
      adjustments: [
        {
          id: 'adj',
          program_id: 'p',
          week_index: 1,
          volume_factor: 0.5,
          load_factor: 1,
          note: null,
          created_at: '',
        },
      ],
      reference1rm: { row: 100 },
    });
    const { session } = buildSession({
      bundle: b,
      workout: workout([
        {
          id: 'we1',
          exercise: 'row',
          sets: [
            ps('a', 0, { load_kg: null, load_pct_1rm: 75 }),
            ps('b', 1),
            ps('c', 2),
            ps('d', 3),
          ],
        },
      ]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    expect(session.exercises[0]?.sets).toHaveLength(2);
    expect(session.exercises[0]?.sets[0]?.loadKg).toBe(75);
  });

  it('valide une série, enregistre la série et lance le minuteur de repos', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0), ps('b', 1)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const r = validateSet(session, 0, 0, true, b, ctx(T0 + 60_000));
    expect(r.ops[0]).toMatchObject({
      table: 'set_logs',
      payload: { load_kg: 60, reps: 10, completed: true, rest_seconds_prescribed: 90 },
    });
    expect(r.session.rest).toMatchObject({ prescribed: 90, endsAt: T0 + 60_000 + 90_000 });
    expect(r.session.current).toEqual({ ex: 0, set: 1 });

    // Repos réel : 2 min 05 (bouton « Je reprends »).
    const ended = endRest(r.session, { now: T0 + 60_000 + 125_000 });
    expect(ended.ops[0]?.payload).toMatchObject({ rest_seconds_actual: 125 });
    expect(ended.session.rest).toBeNull();
    expect(endRest(ended.session, { now: T0 })).toEqual({ session: ended.session, ops: [] });
  });

  it('le repos se termine aussi à la validation de la série suivante', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0), ps('b', 1)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const s1 = validateSet(session, 0, 0, true, b, ctx(T0));
    const s2 = validateSet(s1.session, 0, 1, true, b, ctx(T0 + 100_000));
    expect(s2.ops[0]?.payload).toMatchObject({ rest_seconds_actual: 100 });
    // Plus aucune série : pas de nouveau repos.
    expect(s2.session.rest).toBeNull();
  });

  it('détecte un record et l’enregistre (une seule fois)', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0), ps('b', 1)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const edited = updateSet(session, 0, 0, { loadKg: 62.5, reps: 8 });
    expect(edited.ops).toEqual([]);
    const r = validateSet(edited.session, 0, 0, true, b, ctx());
    expect(r.record).toMatchObject({ recordType: 'max_load', value: 62.5, previous: 60 });
    const recordOp = r.ops.find((o) => o.table === 'personal_records');
    expect(recordOp?.payload).toMatchObject({
      id: recordId(r.session.exercises[0]!.sets[0]!.id),
      record_type: 'max_load',
    });
    // Même charge à la série suivante : plus un record.
    const r2 = validateSet(
      updateSet(r.session, 0, 1, { loadKg: 62.5, reps: 8 }).session,
      0,
      1,
      true,
      b,
      ctx(),
    );
    expect(r2.record).toBeNull();
  });

  it('une série ratée n’est pas un record', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const r = validateSet(updateSet(session, 0, 0, { loadKg: 100 }).session, 0, 0, false, b, ctx());
    expect(r.record).toBeNull();
    expect(r.ops[0]?.payload).toMatchObject({ completed: false });
  });

  it('enchaîne les exercices d’un superset sans repos entre eux', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([
        { id: 'we1', exercise: 'bench', group: 'A', sets: [ps('a', 0), ps('b', 1)] },
        { id: 'we2', exercise: 'row', group: 'A', sets: [ps('c', 0), ps('d', 1)] },
      ]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const s1 = validateSet(session, 0, 0, true, b, ctx());
    expect(s1.session.current).toEqual({ ex: 1, set: 0 });
    expect(s1.session.rest).toBeNull();
    const s2 = validateSet(s1.session, 1, 0, true, b, ctx());
    expect(s2.session.current).toEqual({ ex: 0, set: 1 });
    expect(s2.session.rest).not.toBeNull();
  });

  it('passe à l’exercice suivant puis indique la fin', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([
        { id: 'we1', exercise: 'bench', sets: [ps('a', 0)] },
        { id: 'we2', exercise: 'row', sets: [ps('c', 0)] },
      ]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const s1 = validateSet(session, 0, 0, true, b, ctx());
    expect(s1.session.current).toEqual({ ex: 1, set: 0 });
    const s2 = validateSet(s1.session, 1, 0, true, b, ctx());
    expect(nextPosition(s2.session, 1)).toBeNull();
  });

  it('ajoute une série, remplace un exercice, ajuste le minuteur', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const more = addSet(session, 0, makeId);
    expect(more.exercises[0]?.sets).toHaveLength(2);
    expect(more.exercises[0]?.sets[1]?.prescribedSetId).toBeNull();
    const replaced = replaceExercise(more, 0, 'db', b);
    expect(replaced.exercises[0]).toMatchObject({ exerciseId: 'db', plannedExerciseId: 'bench' });
    expect(replaced.exercises[0]?.sets[0]?.loadKg).toBeNull();
    const v = validateSet(replaced, 0, 0, true, b, ctx());
    expect(v.ops[0]?.payload).toMatchObject({ exercise_id: 'db', workout_exercise_id: 'we1' });
    const longer = adjustRest(v.session, 30, T0);
    expect(longer.rest?.endsAt).toBe((v.session.rest?.endsAt ?? 0) + 30_000);
    expect(adjustRest(longer, -10_000, T0 + 5000).rest?.endsAt).toBe(T0 + 5000);
  });

  it('termine la séance avec ressenti, résumé et historique local', () => {
    const b = bundle();
    const { session } = buildSession({
      bundle: b,
      workout: workout([{ id: 'we1', exercise: 'bench', sets: [ps('a', 0), ps('b', 1)] }]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    const s1 = validateSet(
      updateSet(session, 0, 0, { reps: 11 }).session,
      0,
      0,
      true,
      b,
      ctx(T0 + 60_000),
    );
    const s2 = validateSet(s1.session, 0, 1, true, b, ctx(T0 + 200_000));
    const done = finishSession(
      s2.session,
      { rating: 8, notes: '  Bonne séance  ' },
      b,
      ctx(T0 + 45 * 60_000),
    );
    expect(done.summary).toMatchObject({
      durationSeconds: 2700,
      completedSets: 2,
      totalReps: 20,
      totalVolumeKg: 1200,
    });
    const last = done.ops[done.ops.length - 1];
    expect(last).toMatchObject({
      table: 'session_logs',
      payload: { status: 'completed', rating: 8, notes: 'Bonne séance', duration_seconds: 2700 },
    });
    // Volume 1200 > 1140 la dernière fois → record de volume.
    expect(done.summary.records.map((r) => r.recordType)).toContain('session_volume');
    expect(done.localRecord.session.status).toBe('completed');
    expect(done.localRecord.sets).toHaveLength(2);
  });

  it('reprend la charge utilisée pour les séries suivantes sans charge prévue', () => {
    const b = bundle({ sets: [], sessions: [] });
    const { session } = buildSession({
      bundle: b,
      workout: workout([
        {
          id: 'we1',
          exercise: 'bench',
          sets: [ps('a', 0, { load_kg: null }), ps('b', 1, { load_kg: null })],
        },
      ]),
      adherentId: 'u1',
      ctx: ctx(),
    });
    expect(session.exercises[0]?.sets[1]?.loadKg).toBeNull();
    const r = validateSet(updateSet(session, 0, 0, { loadKg: 50 }).session, 0, 0, true, b, ctx());
    expect(r.session.exercises[0]?.sets[1]?.loadKg).toBe(50);
  });
});
