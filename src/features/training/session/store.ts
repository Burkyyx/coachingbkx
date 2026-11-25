import { create } from 'zustand';

import type { RecordDraft } from '@/core';
import { uuid } from '@/lib/uuid';
import { localStore } from '@/offline/store';
import { saveOffline } from '@/offline/sync';

import { addLocalSession, type AdherentBundle } from '../bundle';
import type { ScheduledWorkout } from '../derive';
import * as engine from './engine';
import { cancelRestAlarm, scheduleRestAlarm } from './restAlarm';

/**
 * SÉANCE EN COURS
 * ---------------
 * L'état est enregistré sur l'appareil après chaque action : si l'app est fermée
 * (ou le téléphone redémarre) en pleine séance, on la reprend exactement où on en était.
 */

const key = (uid: string) => `active-session:${uid}`;

type State = {
  uid: string | null;
  session: engine.ActiveSession | null;
  hydrated: boolean;
  /** Dernier record battu (pour l'animation de célébration). */
  celebration: RecordDraft | null;
  /** Alerte de fin de repos activée (préférence de notifications). */
  restAlarm: boolean;
};

export const useActiveSession = create<State>()(() => ({
  uid: null,
  session: null,
  hydrated: false,
  celebration: null,
  restAlarm: true,
}));

async function persist(session: engine.ActiveSession | null) {
  const { uid } = useActiveSession.getState();
  if (!uid) return;
  if (session) await localStore.setDoc(key(uid), session);
  else await localStore.deleteDoc(key(uid));
}

async function apply(session: engine.ActiveSession | null, ops: engine.SyncOp[]) {
  const previousRest = useActiveSession.getState().session?.rest ?? null;
  useActiveSession.setState({ session });
  await persist(session);
  for (const op of ops) await saveOffline(op.table, op.payload);
  const rest = session?.rest ?? null;
  if (rest && rest.endsAt !== previousRest?.endsAt && useActiveSession.getState().restAlarm) {
    await scheduleRestAlarm(rest.endsAt);
  }
  if (!rest && previousRest) await cancelRestAlarm();
}

const ctx = () => ({ now: Date.now(), makeId: uuid });

export const sessionActions = {
  /** Recharge une séance interrompue (au démarrage de l'espace adhérent). */
  setRestAlarm(enabled: boolean) {
    useActiveSession.setState({ restAlarm: enabled });
  },

  async hydrate(uid: string) {
    const saved = await localStore.getDoc<engine.ActiveSession>(key(uid));
    useActiveSession.setState({ uid, session: saved, hydrated: true });
    // Séance sans exercice restée bloquée (ancienne version de l'app) : on l'annule.
    if (saved && saved.exercises.length === 0) await sessionActions.abandon();
  },

  async start(bundle: AdherentBundle, workout: ScheduledWorkout) {
    const { uid } = useActiveSession.getState();
    // Pas de séance sans exercice (le coach ne l'a pas encore remplie).
    if (!uid || workout.exercises.length === 0) return null;
    const { session, ops } = engine.buildSession({ bundle, workout, adherentId: uid, ctx: ctx() });
    await apply(session, ops);
    return session;
  },

  async update(exIdx: number, setIdx: number, patch: Parameters<typeof engine.updateSet>[3]) {
    const s = useActiveSession.getState().session;
    if (!s) return;
    const r = engine.updateSet(s, exIdx, setIdx, patch);
    await apply(r.session, r.ops);
  },

  async validate(exIdx: number, setIdx: number, completed: boolean, bundle: AdherentBundle) {
    const s = useActiveSession.getState().session;
    if (!s) return null;
    const r = engine.validateSet(s, exIdx, setIdx, completed, bundle, ctx());
    if (r.record) useActiveSession.setState({ celebration: r.record });
    await apply(r.session, r.ops);
    return r.record;
  },

  async endRest() {
    const s = useActiveSession.getState().session;
    if (!s) return;
    const r = engine.endRest(s, ctx());
    await apply(r.session, r.ops);
  },

  async adjustRest(deltaSeconds: number) {
    const s = useActiveSession.getState().session;
    if (!s) return;
    await apply(engine.adjustRest(s, deltaSeconds, Date.now()), []);
  },

  async goTo(ex: number, set: number) {
    const s = useActiveSession.getState().session;
    if (!s) return;
    await apply({ ...s, current: { ex, set } }, []);
  },

  async addSet(exIdx: number) {
    const s = useActiveSession.getState().session;
    if (!s) return;
    await apply(engine.addSet(s, exIdx, uuid), []);
  },

  async replace(exIdx: number, exerciseId: string, bundle: AdherentBundle) {
    const s = useActiveSession.getState().session;
    if (!s) return;
    await apply(engine.replaceExercise(s, exIdx, exerciseId, bundle), []);
  },

  async finish(input: { rating: number | null; notes: string }, bundle: AdherentBundle) {
    const { session: s, uid } = useActiveSession.getState();
    if (!s || !uid) return null;
    const r = engine.finishSession(s, input, bundle, ctx());
    await addLocalSession(uid, r.localRecord);
    await apply(null, r.ops);
    return r.summary;
  },

  async abandon() {
    const s = useActiveSession.getState().session;
    if (!s) return;
    await apply(null, [
      {
        table: 'session_logs',
        payload: engine.sessionPayload(s, 'abandoned', { ended_at: new Date().toISOString() }),
      },
    ]);
  },

  /** Séance supprimée par le coach : on l'arrête sans rien envoyer. */
  async discard() {
    await apply(null, []);
  },

  clearCelebration() {
    useActiveSession.setState({ celebration: null });
  },
};
