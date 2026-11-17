import {
  actualRestSeconds,
  detectSessionVolumeRecord,
  detectSetRecord,
  planExerciseSets,
  prefillSet,
  programWeekIndex,
  summarizeSession,
  type LoggedSet,
  type RecordDraft,
  type SessionSummary,
  type SetType,
} from '@/core';
import type { SyncedTable } from '@/offline/types';

import type { AdherentBundle, HistorySession, HistorySet, LocalSessionRecord } from '../bundle';
import { exerciseHistory, lastPerformance, type ScheduledWorkout } from '../derive';

/**
 * MOTEUR DU MODE SÉANCE (fonctions pures)
 * ---------------------------------------
 * Chaque action renvoie le nouvel état de la séance + les écritures à envoyer
 * au serveur (via la file d'attente hors-ligne). Aucune dépendance à l'écran.
 */

export type SetStatus = 'todo' | 'done' | 'failed';

export type ActiveSet = {
  id: string;
  prescribedSetId: string | null;
  position: number;
  setType: SetType;
  repsMin: number | null;
  repsMax: number | null;
  targetLoadKg: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  durationSeconds: number | null;
  tempo: string | null;
  missingReference1rm: boolean;
  // Valeurs saisies
  loadKg: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  status: SetStatus;
  performedAt: string | null;
  restSecondsActual: number | null;
  note: string | null;
  record: RecordDraft | null;
};

export type ActiveExercise = {
  key: string;
  workoutExerciseId: string | null;
  plannedExerciseId: string;
  exerciseId: string;
  supersetGroup: string | null;
  coachNotes: string | null;
  hint: string | null;
  sets: ActiveSet[];
};

export type RestTimer = {
  setId: string;
  startedAt: number;
  endsAt: number;
  prescribed: number;
};

export type ActiveSession = {
  id: string;
  adherentId: string;
  programId: string | null;
  workoutId: string | null;
  workoutName: string;
  scheduledDate: string | null;
  startedAt: string;
  effortScale: 'rir' | 'rpe';
  current: { ex: number; set: number };
  rest: RestTimer | null;
  exercises: ActiveExercise[];
};

export type SyncOp = { table: SyncedTable; payload: { id: string } & Record<string, unknown> };

type Ctx = { now: number; makeId: () => string };

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

function buildSets(
  bundle: AdherentBundle,
  exerciseId: string,
  prescribed: Parameters<typeof planExerciseSets>[0],
  adjustment: { volumeFactor: number; loadFactor: number } | null,
  makeId: () => string,
  coachTargetReps: number | null = null,
): ActiveSet[] {
  const ex = bundle.exercises.find((e) => e.id === exerciseId);
  const history = exerciseHistory(bundle, exerciseId);
  const planned = planExerciseSets(prescribed, {
    reference1rmKg: bundle.reference1rm[exerciseId] ?? null,
    incrementKg: Number(ex?.load_increment_kg ?? 2.5),
    adjustment,
  });
  let workingIndex = 0;
  return planned.map((p) => {
    const last = p.setType === 'warmup' ? null : lastPerformance(history, workingIndex++);
    const prefill = prefillSet(p, last, coachTargetReps);
    return {
      id: makeId(),
      prescribedSetId: p.id,
      position: p.position,
      setType: p.setType,
      repsMin: p.repsMin,
      repsMax: p.repsMax,
      targetLoadKg: p.targetLoadKg,
      targetRir: p.targetRir,
      targetRpe: p.targetRpe,
      restSeconds: p.restSeconds,
      durationSeconds: p.durationSeconds,
      tempo: p.tempo,
      missingReference1rm: p.missingReference1rm,
      loadKg: prefill.loadKg,
      reps: p.durationSeconds !== null && p.repsMin === null ? null : prefill.reps,
      rir: null,
      rpe: null,
      status: 'todo',
      performedAt: null,
      restSecondsActual: null,
      note: null,
      record: null,
    };
  });
}

/** Prépare une séance à partir d'une séance prévue du programme. */
export function buildSession(args: {
  bundle: AdherentBundle;
  workout: ScheduledWorkout;
  adherentId: string;
  ctx: Ctx;
}): { session: ActiveSession; ops: SyncOp[] } {
  const { bundle, workout, adherentId, ctx } = args;
  const week = bundle.program?.start_date
    ? programWeekIndex(bundle.program.start_date, workout.date)
    : workout.week_index;
  const adj = bundle.adjustments.find((a) => a.week_index === (week || workout.week_index));
  const adjustment = adj
    ? { volumeFactor: Number(adj.volume_factor), loadFactor: Number(adj.load_factor) }
    : null;

  const exercises: ActiveExercise[] = workout.exercises.map((we) => ({
    key: we.id,
    workoutExerciseId: we.id,
    plannedExerciseId: we.exercise_id,
    exerciseId: we.exercise_id,
    supersetGroup: we.superset_group,
    coachNotes: we.coach_notes,
    hint: we.next_session_hint,
    sets: buildSets(
      bundle,
      we.exercise_id,
      we.sets.map((s) => ({
        id: s.id,
        position: s.position,
        setType: s.set_type,
        repsMin: s.reps_min,
        repsMax: s.reps_max,
        loadKg: s.load_kg === null ? null : Number(s.load_kg),
        loadPct1rm: s.load_pct_1rm === null ? null : Number(s.load_pct_1rm),
        targetRir: s.target_rir === null ? null : Number(s.target_rir),
        targetRpe: s.target_rpe === null ? null : Number(s.target_rpe),
        restSeconds: s.rest_seconds,
        tempo: s.tempo,
        durationSeconds: s.duration_seconds,
      })),
      adjustment,
      ctx.makeId,
      we.next_session_target_reps ?? null,
    ),
  }));

  const session: ActiveSession = {
    id: ctx.makeId(),
    adherentId,
    programId: bundle.program?.id ?? null,
    workoutId: workout.id,
    workoutName: workout.name,
    scheduledDate: workout.date,
    startedAt: new Date(ctx.now).toISOString(),
    effortScale: bundle.effortScale,
    current: { ex: 0, set: 0 },
    rest: null,
    exercises,
  };
  return {
    session,
    ops: [{ table: 'session_logs', payload: sessionPayload(session, 'in_progress') }],
  };
}

// ---------------------------------------------------------------------------
// Écritures envoyées au serveur
// ---------------------------------------------------------------------------

export function sessionPayload(
  s: ActiveSession,
  status: 'in_progress' | 'completed' | 'abandoned',
  extra: Record<string, unknown> = {},
) {
  return {
    id: s.id,
    adherent_id: s.adherentId,
    program_id: s.programId,
    workout_id: s.workoutId,
    scheduled_date: s.scheduledDate,
    started_at: s.startedAt,
    status,
    ...extra,
  };
}

export function setPayload(s: ActiveSession, ex: ActiveExercise, set: ActiveSet) {
  return {
    id: set.id,
    session_log_id: s.id,
    adherent_id: s.adherentId,
    exercise_id: ex.exerciseId,
    workout_exercise_id: ex.workoutExerciseId,
    prescribed_set_id: set.prescribedSetId,
    position: set.position,
    set_type: set.setType,
    load_kg: set.loadKg,
    reps: set.reps,
    rir: set.rir,
    rpe: set.rpe,
    duration_seconds: set.durationSeconds,
    rest_seconds_actual: set.restSecondsActual,
    rest_seconds_prescribed: set.restSeconds,
    completed: set.status === 'done',
    note: set.note,
    performed_at: set.performedAt,
  };
}

function toLogged(set: ActiveSet): LoggedSet {
  return {
    setType: set.setType,
    loadKg: set.loadKg,
    reps: set.reps,
    rir: set.rir,
    rpe: set.rpe,
    completed: set.status === 'done',
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function cloneSession(s: ActiveSession): ActiveSession {
  return {
    ...s,
    exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })),
  };
}

function findSet(s: ActiveSession, setId: string): { ex: ActiveExercise; set: ActiveSet } | null {
  for (const ex of s.exercises) {
    const set = ex.sets.find((x) => x.id === setId);
    if (set) return { ex, set };
  }
  return null;
}

/** Modifie les valeurs d'une série (avant ou après validation). */
export function updateSet(
  s: ActiveSession,
  exIdx: number,
  setIdx: number,
  patch: Partial<Pick<ActiveSet, 'loadKg' | 'reps' | 'rir' | 'rpe' | 'note' | 'durationSeconds'>>,
): { session: ActiveSession; ops: SyncOp[] } {
  const next = cloneSession(s);
  const ex = next.exercises[exIdx];
  const set = ex?.sets[setIdx];
  if (!ex || !set) return { session: s, ops: [] };
  Object.assign(set, patch);
  // Série déjà validée : la correction est aussi envoyée.
  const ops: SyncOp[] =
    set.status === 'todo' ? [] : [{ table: 'set_logs', payload: setPayload(next, ex, set) }];
  return { session: next, ops };
}

/** Termine le repos en cours et enregistre le temps de repos réel. */
export function endRest(
  s: ActiveSession,
  ctx: Pick<Ctx, 'now'>,
): { session: ActiveSession; ops: SyncOp[] } {
  if (!s.rest) return { session: s, ops: [] };
  const next = cloneSession(s);
  const found = findSet(next, s.rest.setId);
  next.rest = null;
  if (!found) return { session: next, ops: [] };
  found.set.restSecondsActual = actualRestSeconds(s.rest.startedAt, ctx.now);
  return {
    session: next,
    ops: [{ table: 'set_logs', payload: setPayload(next, found.ex, found.set) }],
  };
}

/** Prochaine série à faire, en tenant compte des supersets. */
export function nextPosition(
  s: ActiveSession,
  fromEx: number,
): { ex: number; set: number; inSuperset: boolean } | null {
  const done = (e: ActiveExercise) => e.sets.filter((x) => x.status !== 'todo').length;
  const firstTodo = (e: ActiveExercise) => e.sets.findIndex((x) => x.status === 'todo');
  const current = s.exercises[fromEx];
  if (current?.supersetGroup) {
    const group = s.exercises
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.supersetGroup === current.supersetGroup);
    const round = done(current);
    // Un autre exercice du superset n'a pas encore fait ce tour → on y va sans repos.
    const pending = group.find(({ e, i }) => i !== fromEx && done(e) < round && firstTodo(e) >= 0);
    if (pending) return { ex: pending.i, set: firstTodo(pending.e), inSuperset: true };
    const nextRound = group.find(({ e }) => firstTodo(e) >= 0);
    if (nextRound) return { ex: nextRound.i, set: firstTodo(nextRound.e), inSuperset: false };
  } else if (current && firstTodo(current) >= 0) {
    return { ex: fromEx, set: firstTodo(current), inSuperset: false };
  }
  for (let i = 0; i < s.exercises.length; i++) {
    const e = s.exercises[(fromEx + 1 + i) % s.exercises.length];
    if (e && firstTodo(e) >= 0) {
      return { ex: (fromEx + 1 + i) % s.exercises.length, set: firstTodo(e), inSuperset: false };
    }
  }
  return null;
}

/**
 * Valide (ou marque ratée) une série :
 *  - termine le repos précédent (repos réel enregistré) ;
 *  - détecte un éventuel record ;
 *  - démarre le minuteur de repos (sauf au milieu d'un superset) ;
 *  - passe à la série suivante.
 */
export function validateSet(
  s: ActiveSession,
  exIdx: number,
  setIdx: number,
  completed: boolean,
  bundle: AdherentBundle,
  ctx: Pick<Ctx, 'now'>,
): { session: ActiveSession; ops: SyncOp[]; record: RecordDraft | null } {
  const ops: SyncOp[] = [];
  let next = s;
  if (s.rest) {
    const ended = endRest(s, ctx);
    next = ended.session;
    ops.push(...ended.ops);
  }
  next = cloneSession(next);
  const ex = next.exercises[exIdx];
  const set = ex?.sets[setIdx];
  if (!ex || !set) return { session: s, ops: [], record: null };

  set.status = completed ? 'done' : 'failed';
  set.performedAt = new Date(ctx.now).toISOString();

  // Séries suivantes sans charge prévue : on reprend la charge qui vient d'être utilisée.
  if (set.loadKg !== null) {
    for (const later of ex.sets.slice(setIdx + 1)) {
      if (later.status === 'todo' && later.loadKg === null && later.targetLoadKg === null) {
        later.loadKg = set.loadKg;
      }
    }
  }

  // Record : comparé à tout l'historique + séries déjà faites aujourd'hui sur cet exercice.
  const prior: LoggedSet[] = [
    ...exerciseHistory(bundle, ex.exerciseId, next.id).flatMap((h) => h.sets),
    ...next.exercises
      .filter((e) => e.exerciseId === ex.exerciseId)
      .flatMap((e) => e.sets.filter((x) => x.id !== set.id && x.status !== 'todo').map(toLogged)),
  ];
  const record = completed ? detectSetRecord(toLogged(set), prior) : null;
  set.record = record;
  ops.push({ table: 'set_logs', payload: setPayload(next, ex, set) });
  if (record) {
    ops.push({
      table: 'personal_records',
      payload: {
        id: recordId(set.id),
        adherent_id: next.adherentId,
        exercise_id: ex.exerciseId,
        record_type: record.recordType,
        value: record.value,
        load_kg: record.loadKg,
        achieved_at: set.performedAt,
        set_log_id: set.id,
        session_log_id: next.id,
      },
    });
  }

  const pos = nextPosition(next, exIdx);
  if (pos) next.current = { ex: pos.ex, set: pos.set };
  const restSeconds = set.restSeconds ?? 0;
  if (!pos?.inSuperset && restSeconds > 0 && pos) {
    next.rest = {
      setId: set.id,
      startedAt: ctx.now,
      endsAt: ctx.now + restSeconds * 1000,
      prescribed: restSeconds,
    };
  }
  return { session: next, ops, record };
}

/**
 * Identifiant du record dérivé de celui de la série (stable : renvoyer la même
 * validation ne crée pas deux records).
 */
export function recordId(setId: string): string {
  const hex = setId.replace(/-/g, '');
  const flipped = hex
    .split('')
    .map((c, i) => (i === 12 ? 'f' : c))
    .join('');
  return `${flipped.slice(0, 8)}-${flipped.slice(8, 12)}-${flipped.slice(12, 16)}-${flipped.slice(16, 20)}-${flipped.slice(20, 32)}`;
}

/** Ajoute / retire du temps au minuteur. */
export function adjustRest(s: ActiveSession, deltaSeconds: number, now: number): ActiveSession {
  if (!s.rest) return s;
  return { ...s, rest: { ...s.rest, endsAt: Math.max(now, s.rest.endsAt + deltaSeconds * 1000) } };
}

/** Ajoute une série supplémentaire (copie de la dernière). */
export function addSet(s: ActiveSession, exIdx: number, makeId: () => string): ActiveSession {
  const next = cloneSession(s);
  const ex = next.exercises[exIdx];
  const last = ex?.sets[ex.sets.length - 1];
  if (!ex || !last) return s;
  ex.sets.push({
    ...last,
    id: makeId(),
    prescribedSetId: null,
    position: last.position + 1,
    status: 'todo',
    performedAt: null,
    restSecondsActual: null,
    note: null,
    record: null,
  });
  return next;
}

/** Remplace un exercice (machine prise) : les séries restantes passent sur l'alternative. */
export function replaceExercise(
  s: ActiveSession,
  exIdx: number,
  exerciseId: string,
  bundle: AdherentBundle,
): ActiveSession {
  const next = cloneSession(s);
  const ex = next.exercises[exIdx];
  if (!ex) return s;
  ex.exerciseId = exerciseId;
  const history = exerciseHistory(bundle, exerciseId);
  let working = 0;
  for (const set of ex.sets) {
    if (set.setType !== 'warmup') working++;
    if (set.status !== 'todo') continue;
    const last = set.setType === 'warmup' ? null : lastPerformance(history, working - 1);
    // Charge cible du coach non transposable : on repart de la dernière perf sur l'alternative.
    set.targetLoadKg = null;
    set.loadKg = last?.loadKg ?? null;
    set.reps = last?.reps ?? set.repsMin ?? set.repsMax;
  }
  return next;
}

export type FinishResult = {
  ops: SyncOp[];
  summary: SessionSummary & { records: RecordDraft[] };
  localRecord: LocalSessionRecord;
};

/** Termine la séance : ressenti, notes, résumé (durée, volume, records). */
export function finishSession(
  s: ActiveSession,
  input: { rating: number | null; notes: string },
  bundle: AdherentBundle,
  ctx: Ctx,
): FinishResult {
  const ops: SyncOp[] = [];
  let state = s;
  if (s.rest) {
    const ended = endRest(s, ctx);
    state = ended.session;
    ops.push(...ended.ops);
  }
  const allSets = state.exercises.flatMap((e) =>
    e.sets.filter((x) => x.status !== 'todo').map(toLogged),
  );
  const summary = summarizeSession(Date.parse(state.startedAt), ctx.now, allSets);
  const records = state.exercises.flatMap((e) =>
    e.sets.map((x) => x.record).filter((r): r is RecordDraft => r !== null),
  );

  // Record de volume par exercice.
  for (const ex of state.exercises) {
    const done = ex.sets.filter((x) => x.status !== 'todo').map(toLogged);
    const vol = detectSessionVolumeRecord(done, exerciseHistory(bundle, ex.exerciseId, state.id));
    if (vol) {
      records.push(vol);
      ops.push({
        table: 'personal_records',
        payload: {
          id: ctx.makeId(),
          adherent_id: state.adherentId,
          exercise_id: ex.exerciseId,
          record_type: 'session_volume',
          value: vol.value,
          load_kg: null,
          achieved_at: new Date(ctx.now).toISOString(),
          session_log_id: state.id,
        },
      });
    }
  }

  const endedAt = new Date(ctx.now).toISOString();
  ops.push({
    table: 'session_logs',
    payload: sessionPayload(state, 'completed', {
      ended_at: endedAt,
      duration_seconds: summary.durationSeconds,
      rating: input.rating,
      notes: input.notes.trim() || null,
    }),
  });

  const session: HistorySession = {
    id: state.id,
    workout_id: state.workoutId,
    program_id: state.programId,
    scheduled_date: state.scheduledDate,
    started_at: state.startedAt,
    ended_at: endedAt,
    status: 'completed',
    rating: input.rating,
    duration_seconds: summary.durationSeconds,
  };
  const sets: HistorySet[] = state.exercises.flatMap((ex) =>
    ex.sets
      .filter((x) => x.status !== 'todo')
      .map((x) => ({
        id: x.id,
        session_log_id: state.id,
        exercise_id: ex.exerciseId,
        workout_exercise_id: ex.workoutExerciseId,
        position: x.position,
        set_type: x.setType,
        load_kg: x.loadKg,
        reps: x.reps,
        rir: x.rir,
        rpe: x.rpe,
        completed: x.status === 'done',
        performed_at: x.performedAt ?? endedAt,
        rest_seconds_actual: x.restSecondsActual,
        rest_seconds_prescribed: x.restSeconds,
        duration_seconds: x.durationSeconds,
      })),
  );
  return { ops, summary: { ...summary, records }, localRecord: { session, sets } };
}
