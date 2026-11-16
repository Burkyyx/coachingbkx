import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import {
  fetchProgramTree,
  type Program,
  type WeekAdjustment,
  type WorkoutNode,
} from '@/features/programs/api';
import { isNetworkError } from '@/lib/errors';
import { supabase, type Enums, type Tables } from '@/lib/supabase';
import { localStore } from '@/offline/store';
import { onSynced } from '@/offline/sync';

/**
 * COPIE LOCALE DES DONNÉES DE L'ADHÉRENT
 * --------------------------------------
 * Tout ce qu'il faut pour faire une séance sans réseau : programme en cours,
 * bibliothèque d'exercices, 1RM de référence, historique récent.
 * Rechargé dès que le réseau est disponible, sinon lu depuis l'appareil.
 */

export type BundleExercise = Pick<
  Tables<'exercises'>,
  | 'id'
  | 'name'
  | 'primary_muscle'
  | 'equipment'
  | 'type'
  | 'load_increment_kg'
  | 'instructions'
  | 'video_path'
  | 'video_url'
>;

export type HistorySession = Pick<
  Tables<'session_logs'>,
  | 'id'
  | 'workout_id'
  | 'program_id'
  | 'scheduled_date'
  | 'started_at'
  | 'ended_at'
  | 'status'
  | 'rating'
  | 'duration_seconds'
>;

export type HistorySet = Pick<
  Tables<'set_logs'>,
  | 'id'
  | 'session_log_id'
  | 'exercise_id'
  | 'workout_exercise_id'
  | 'position'
  | 'set_type'
  | 'load_kg'
  | 'reps'
  | 'rir'
  | 'rpe'
  | 'completed'
  | 'performed_at'
  | 'rest_seconds_actual'
  | 'rest_seconds_prescribed'
  | 'duration_seconds'
>;

export type AdherentBundle = {
  fetchedAt: string;
  effortScale: Enums<'effort_scale'>;
  program: Program | null;
  workouts: WorkoutNode[];
  adjustments: WeekAdjustment[];
  exercises: BundleExercise[];
  alternatives: Record<string, string[]>;
  reference1rm: Record<string, number>;
  sessions: HistorySession[];
  sets: HistorySet[];
};

/** Séances enregistrées sur l'appareil (gardées jusqu'à ce que le serveur les renvoie). */
export type LocalSessionRecord = { session: HistorySession; sets: HistorySet[] };

const HISTORY_DAYS = 120;
const bundleKey = (uid: string) => `bundle:${uid}`;
export const localSessionsKey = (uid: string) => `local-sessions:${uid}`;
export const bundleQueryKey = (uid: string | null) => ['adherent-bundle', uid] as const;

async function fetchRemoteBundle(uid: string): Promise<AdherentBundle> {
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const [profile, programs, exercises, alternatives, refs, sessions] = await Promise.all([
    supabase.from('profiles').select('effort_scale').eq('id', uid).single(),
    supabase
      .from('programs')
      .select('id')
      .eq('adherent_id', uid)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1),
    supabase
      .from('exercises')
      .select(
        'id, name, primary_muscle, equipment, type, load_increment_kg, instructions, video_path, video_url',
      ),
    supabase.from('exercise_alternatives').select('exercise_id, alternative_id'),
    supabase.from('reference_1rm').select('exercise_id, value_kg').eq('adherent_id', uid),
    supabase
      .from('session_logs')
      .select(
        'id, workout_id, program_id, scheduled_date, started_at, ended_at, status, rating, duration_seconds',
      )
      .eq('adherent_id', uid)
      .gte('started_at', since)
      .order('started_at'),
  ]);
  for (const r of [profile, programs, exercises, alternatives, refs, sessions])
    if (r.error) throw r.error;

  const sessionIds = (sessions.data ?? []).map((s) => s.id);
  const sets = sessionIds.length
    ? await supabase
        .from('set_logs')
        .select(
          'id, session_log_id, exercise_id, workout_exercise_id, position, set_type, load_kg, reps, rir, rpe, completed, performed_at, rest_seconds_actual, rest_seconds_prescribed, duration_seconds',
        )
        .eq('adherent_id', uid)
        .gte('performed_at', since)
        .order('performed_at')
    : { data: [], error: null };
  if (sets.error) throw sets.error;

  const programId = programs.data?.[0]?.id ?? null;
  const tree = programId ? await fetchProgramTree(programId) : null;

  const alt: Record<string, string[]> = {};
  for (const a of alternatives.data ?? [])
    alt[a.exercise_id] = [...(alt[a.exercise_id] ?? []), a.alternative_id];
  const ref: Record<string, number> = {};
  for (const r of refs.data ?? []) ref[r.exercise_id] = Number(r.value_kg);

  return {
    fetchedAt: new Date().toISOString(),
    effortScale: profile.data?.effort_scale ?? 'rir',
    program: tree?.program ?? null,
    workouts: tree?.workouts ?? [],
    adjustments: tree?.adjustments ?? [],
    exercises: exercises.data ?? [],
    alternatives: alt,
    reference1rm: ref,
    sessions: sessions.data ?? [],
    sets: sets.data ?? [],
  };
}

/** Ajoute à la copie serveur les séances enregistrées sur l'appareil et pas encore reçues. */
export function mergeLocalSessions(
  bundle: AdherentBundle,
  local: readonly LocalSessionRecord[],
): AdherentBundle {
  const known = new Set(bundle.sessions.map((s) => s.id));
  const knownSets = new Set(bundle.sets.map((s) => s.id));
  const extraSessions = local.filter((l) => !known.has(l.session.id)).map((l) => l.session);
  const extraSets = local.flatMap((l) => l.sets).filter((s) => !knownSets.has(s.id));
  return {
    ...bundle,
    sessions: [...bundle.sessions, ...extraSessions].sort((a, b) =>
      a.started_at.localeCompare(b.started_at),
    ),
    sets: [...bundle.sets, ...extraSets].sort((a, b) =>
      a.performed_at.localeCompare(b.performed_at),
    ),
  };
}

export async function loadBundle(uid: string): Promise<AdherentBundle | null> {
  let bundle: AdherentBundle | null;
  try {
    bundle = await fetchRemoteBundle(uid);
    await localStore.setDoc(bundleKey(uid), bundle);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    bundle = await localStore.getDoc<AdherentBundle>(bundleKey(uid));
    if (!bundle) throw error;
  }
  const local = (await localStore.getDoc<LocalSessionRecord[]>(localSessionsKey(uid))) ?? [];
  // On ne garde localement que ce que le serveur n'a pas encore renvoyé.
  const serverIds = new Set(bundle.sessions.map((s) => s.id));
  const stillLocal = local.filter(
    (l) => !serverIds.has(l.session.id) || l.session.status !== 'completed',
  );
  if (stillLocal.length !== local.length)
    await localStore.setDoc(localSessionsKey(uid), stillLocal);
  return mergeLocalSessions(bundle, local);
}

/** Données d'entraînement de l'adhérent connecté (disponibles hors-ligne). */
export function useAdherentBundle() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  useEffect(
    () => onSynced(() => void qc.invalidateQueries({ queryKey: bundleQueryKey(userId) })),
    [qc, userId],
  );
  return useQuery({
    queryKey: bundleQueryKey(userId),
    enabled: userId !== null,
    queryFn: () => loadBundle(userId as string),
    staleTime: 60_000,
  });
}

/** Ajoute une séance terminée à l'historique local (affichage immédiat, même hors-ligne). */
export async function addLocalSession(uid: string, record: LocalSessionRecord) {
  const list = (await localStore.getDoc<LocalSessionRecord[]>(localSessionsKey(uid))) ?? [];
  const next = [...list.filter((l) => l.session.id !== record.session.id), record].slice(-60);
  await localStore.setDoc(localSessionsKey(uid), next);
}
