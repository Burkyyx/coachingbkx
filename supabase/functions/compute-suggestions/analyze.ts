// Analyse des séances (logique indépendante de Deno : testable avec Node).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  addDays,
  programWeekIndex,
  runEngine,
  weekStart,
  workoutDate,
  type EngineExercise,
  type ExerciseSession,
  type LoggedSet,
  type RuleRow,
} from '../_shared/core/index.ts';
import { log, todayParis } from '../_shared/util.ts';

type SetRow = {
  id: string;
  session_log_id: string;
  exercise_id: string;
  prescribed_set_id: string | null;
  position: number;
  set_type: LoggedSet['setType'];
  load_kg: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  completed: boolean;
  rest_seconds_actual: number | null;
  rest_seconds_prescribed: number | null;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toLogged(s: SetRow): LoggedSet {
  return {
    id: s.id,
    setType: s.set_type,
    loadKg: num(s.load_kg),
    reps: s.reps,
    rir: num(s.rir),
    rpe: num(s.rpe),
    completed: s.completed,
    restSecondsActual: s.rest_seconds_actual,
    restSecondsPrescribed: s.rest_seconds_prescribed,
  };
}

export async function analyzeSession(db: SupabaseClient, sessionId: string, rules: RuleRow[]) {
  const { data: session } = await db.from('session_logs').select('*').eq('id', sessionId).single();
  if (!session) return { suggestions: 0, alerts: 0 };
  const uid: string = session.adherent_id;
  const today = todayParis();
  const since = addDays(today, -120);

  // Historique de l'adhérent (séances terminées) et séries.
  const { data: sessions } = await db
    .from('session_logs')
    .select('id, started_at, rating')
    .eq('adherent_id', uid)
    .eq('status', 'completed')
    .gte('started_at', since)
    .order('started_at');
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: setsData } = await db
    .from('set_logs')
    .select(
      'id, session_log_id, exercise_id, prescribed_set_id, position, set_type, load_kg, reps, rir, rpe, completed, rest_seconds_actual, rest_seconds_prescribed',
    )
    .in(
      'session_log_id',
      sessionIds.length ? sessionIds : ['00000000-0000-0000-0000-000000000000'],
    );
  const sets = (setsData ?? []) as SetRow[];
  const sessionDate = new Map((sessions ?? []).map((s) => [s.id, s.started_at as string]));

  // Programme : prochaine prescription de chaque exercice.
  const programId: string | null = session.program_id;
  const { data: program } = programId
    ? await db
        .from('programs')
        .select('id, start_date, duration_weeks')
        .eq('id', programId)
        .maybeSingle()
    : { data: null };
  const [{ data: workouts }, { data: wes }, { data: pss }, { data: exercises }, { data: alts }] =
    await Promise.all([
      programId
        ? db.from('workouts').select('id, week_index, day_of_week').eq('program_id', programId)
        : Promise.resolve({ data: [] }),
      programId
        ? db
            .from('workout_exercises')
            .select('id, workout_id, exercise_id, alternative_exercise_ids')
            .eq('program_id', programId)
        : Promise.resolve({ data: [] }),
      programId
        ? db.from('prescribed_sets').select('*').eq('program_id', programId)
        : Promise.resolve({ data: [] }),
      db.from('exercises').select('id, name, type, load_increment_kg'),
      db.from('exercise_alternatives').select('exercise_id, alternative_id'),
    ]);
  const { data: doneWorkouts } = await db
    .from('session_logs')
    .select('workout_id')
    .eq('adherent_id', uid)
    .eq('status', 'completed');
  const done = new Set((doneWorkouts ?? []).map((d) => d.workout_id));
  const exById = new Map((exercises ?? []).map((e) => [e.id, e]));
  const workoutDateById = new Map(
    (workouts ?? []).map((w) => [
      w.id,
      program?.start_date ? workoutDate(program.start_date, w.week_index, w.day_of_week) : '',
    ]),
  );
  const prescribedById = new Map((pss ?? []).map((p) => [p.id, p]));

  const engineExercises: EngineExercise[] = [];
  const exerciseIds = [
    ...new Set(sets.filter((s) => s.session_log_id === sessionId).map((s) => s.exercise_id)),
  ];
  for (const exerciseId of exerciseIds) {
    const ex = exById.get(exerciseId);
    if (!ex) continue;
    // Prochaine occurrence de l'exercice (aujourd'hui ou après, pas encore faite).
    const upcoming = (wes ?? [])
      .filter((we) => we.exercise_id === exerciseId && !done.has(we.workout_id))
      .map((we) => ({ we, date: workoutDateById.get(we.workout_id) ?? '' }))
      .filter((x) => x.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const working = upcoming
      ? (pss ?? [])
          .filter((p) => p.workout_exercise_id === upcoming.we.id && p.set_type === 'working')
          .sort((a, b) => a.position - b.position)[0]
      : undefined;
    const altIds: string[] = upcoming?.we.alternative_exercise_ids?.length
      ? upcoming.we.alternative_exercise_ids
      : (alts ?? []).filter((a) => a.exercise_id === exerciseId).map((a) => a.alternative_id);

    const bySession = new Map<string, SetRow[]>();
    for (const s of sets)
      if (s.exercise_id === exerciseId)
        bySession.set(s.session_log_id, [...(bySession.get(s.session_log_id) ?? []), s]);
    const history: ExerciseSession[] = [...bySession.entries()]
      .map(([sid, list]) => ({
        sessionId: sid,
        date: sessionDate.get(sid) ?? '',
        sets: list.sort((a, b) => a.position - b.position).map(toLogged),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    engineExercises.push({
      exerciseId,
      name: ex.name,
      incrementKg: Number(ex.load_increment_kg),
      loadable: ex.type === 'free_weight' || ex.type === 'machine',
      prescription: working
        ? {
            repsMin: working.reps_min,
            repsMax: working.reps_max,
            loadKg: num(working.load_kg),
            targetRir: num(working.target_rir),
            targetRpe: num(working.target_rpe),
            restSeconds: working.rest_seconds,
          }
        : null,
      alternatives: altIds
        .map((id) => ({ id, name: exById.get(id)?.name ?? '' }))
        .filter((a) => a.name),
      history,
    });
  }

  // Séances récentes (fatigue, repos), avec le RIR cible de chaque série.
  const recent = (sessions ?? []).slice(-5).map((s) => ({
    sessionId: s.id,
    date: s.started_at,
    rating: s.rating,
    sets: sets
      .filter((x) => x.session_log_id === s.id)
      .map((x) => {
        const p = x.prescribed_set_id ? prescribedById.get(x.prescribed_set_id) : undefined;
        const targetRir = p
          ? p.target_rir !== null
            ? Number(p.target_rir)
            : p.target_rpe !== null
              ? 10 - Number(p.target_rpe)
              : null
          : null;
        return { ...toLogged(x), targetRir };
      }),
  }));

  const { data: checkin } = await db
    .from('checkins')
    .select('sleep, energy')
    .eq('adherent_id', uid)
    .gte('week_start', addDays(today, -10))
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextWeekIndex: number | null = null;
  if (program?.start_date) {
    const current = programWeekIndex(program.start_date, today);
    nextWeekIndex = current + 1 <= program.duration_weeks ? Math.max(1, current + 1) : null;
  }

  const output = runEngine({
    adherentId: uid,
    programId,
    sessionId,
    weekStart: weekStart(today),
    nextWeekIndex,
    exercises: engineExercises,
    recentSessions: recent,
    latestCheckin: checkin ?? null,
    rules,
  });

  for (const s of output.suggestions) {
    await db.from('suggestions').delete().eq('dedupe_key', s.dedupeKey).eq('status', 'pending');
    const { data: inserted, error } = await db
      .from('suggestions')
      .insert({
        adherent_id: uid,
        kind: s.kind,
        rule_key: s.ruleKey,
        exercise_id: s.exerciseId,
        program_id: s.programId,
        current_value: s.currentValue,
        proposed_value: s.proposedValue,
        justification: s.justification,
        dedupe_key: s.dedupeKey,
        source_session_id: sessionId,
      })
      .select('id')
      .single();
    if (error) {
      log('suggestion non créée', { code: error.code ?? '' });
      continue;
    }
    if (s.autoApply && s.programId) {
      await db.rpc('apply_suggestion', { p_id: inserted.id });
    }
  }
  if (output.alerts.length) {
    await db.from('alerts').upsert(
      output.alerts.map((a) => ({
        adherent_id: uid,
        type: a.type,
        message: a.message,
        payload: a.payload,
        dedupe_key: a.dedupeKey,
      })),
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    );
  }
  return { suggestions: output.suggestions.length, alerts: output.alerts.length };
}

/**
 * Analyse les séances terminées non encore analysées (toutes, ou celles d'un adhérent).
 */
export async function analyzePending(
  db: SupabaseClient,
  adherentId: string | null = null,
): Promise<{ sessions: number; suggestions: number; alerts: number }> {
  let query = db
    .from('session_logs')
    .select('id, status')
    .is('analyzed_at', null)
    .in('status', ['completed', 'abandoned'])
    .order('started_at')
    .limit(50);
  // Un adhérent ne peut déclencher que l'analyse de ses propres séances.
  if (adherentId) query = query.eq('adherent_id', adherentId);
  const { data: pending, error } = await query;
  if (error) throw new Error('Lecture des séances impossible');

  const { data: ruleRows } = await db.from('progression_rules').select('*');
  const rules: RuleRow[] = (ruleRows ?? []).map((r) => ({
    ruleKey: r.rule_key,
    adherentId: r.adherent_id,
    exerciseId: r.exercise_id,
    params: r.params ?? {},
    enabled: r.enabled,
    autoApply: r.auto_apply,
  }));

  let suggestions = 0;
  let alerts = 0;
  for (const s of pending ?? []) {
    if (s.status === 'completed') {
      try {
        const r = await analyzeSession(db, s.id, rules);
        suggestions += r.suggestions;
        alerts += r.alerts;
      } catch (e) {
        log('analyse en échec', { error: e instanceof Error ? e.message : 'inconnue' });
        continue;
      }
    }
    await db.from('session_logs').update({ analyzed_at: new Date().toISOString() }).eq('id', s.id);
  }
  log('analyse terminée', { sessions: pending?.length ?? 0, suggestions, alerts });
  return { sessions: pending?.length ?? 0, suggestions, alerts };
}
