import { createMemoryStore } from '../memoryStore';
import {
  dropSessionOps,
  enqueue,
  flushOutbox,
  MAX_ATTEMPTS,
  onOutboxChange,
  pendingCount,
  sessionIdsInOutbox,
  type Remote,
} from '../outbox';

let n = 0;
const makeId = () => `op${++n}`;
const isNetworkError = (e: unknown) => (e as { message?: string }).message === 'offline';

/** Faux serveur : enregistre les lignes reçues ; peut simuler une coupure ou un refus. */
function fakeRemote() {
  const rows = new Map<string, Record<string, unknown>>();
  const state = { offline: false, rejectIds: new Set<string>(), calls: 0 };
  const remote: Remote = {
    async upsert(table, row) {
      state.calls++;
      if (state.offline) return { error: { message: 'offline' } };
      if (state.rejectIds.has(String(row.id)))
        return { error: { message: 'refusé par le serveur' } };
      rows.set(`${table}:${row.id}`, { ...(rows.get(`${table}:${row.id}`) ?? {}), ...row });
      return { error: null };
    },
    async remove(table, id) {
      state.calls++;
      if (state.offline) throw new Error('offline');
      rows.delete(`${table}:${id}`);
      return { error: null };
    },
  };
  return { remote, rows, state };
}

describe('file d’attente hors-ligne', () => {
  it('enregistre hors-ligne puis synchronise au retour du réseau', async () => {
    const store = createMemoryStore();
    const { remote, rows, state } = fakeRemote();
    state.offline = true;
    await enqueue(
      store,
      { table: 'session_logs', kind: 'upsert', payload: { id: 's1', status: 'in_progress' } },
      makeId,
    );
    await enqueue(
      store,
      { table: 'set_logs', kind: 'upsert', payload: { id: 'x1', reps: 10 } },
      makeId,
    );

    const offline = await flushOutbox(store, remote, isNetworkError);
    expect(offline).toEqual({ sent: 0, failed: 0, remaining: 2, offline: true });
    expect(rows.size).toBe(0);

    state.offline = false;
    const online = await flushOutbox(store, remote, isNetworkError);
    expect(online).toEqual({ sent: 2, failed: 0, remaining: 0, offline: false });
    expect(rows.get('set_logs:x1')).toEqual({ id: 'x1', reps: 10 });
  });

  it('fusionne les modifications successives d’un même élément (pas de doublon)', async () => {
    const store = createMemoryStore();
    await enqueue(
      store,
      { table: 'set_logs', kind: 'upsert', payload: { id: 'x1', reps: 10, load_kg: 60 } },
      makeId,
    );
    await enqueue(
      store,
      { table: 'set_logs', kind: 'upsert', payload: { id: 'x1', rest_seconds_actual: 95 } },
      makeId,
    );
    const ops = await store.listOutbox();
    expect(ops).toHaveLength(1);
    expect(ops[0]?.payload).toEqual({ id: 'x1', reps: 10, load_kg: 60, rest_seconds_actual: 95 });
  });

  it('garde l’ordre d’envoi (séance avant ses séries)', async () => {
    const store = createMemoryStore();
    const order: string[] = [];
    const remote: Remote = {
      async upsert(table, row) {
        order.push(`${table}:${row.id}`);
        return { error: null };
      },
      async remove() {
        return { error: null };
      },
    };
    await enqueue(store, { table: 'session_logs', kind: 'upsert', payload: { id: 's1' } }, makeId);
    await enqueue(store, { table: 'set_logs', kind: 'upsert', payload: { id: 'a' } }, makeId);
    await enqueue(store, { table: 'set_logs', kind: 'upsert', payload: { id: 'b' } }, makeId);
    await enqueue(
      store,
      { table: 'session_logs', kind: 'upsert', payload: { id: 's1', status: 'completed' } },
      makeId,
    );
    await flushOutbox(store, remote, isNetworkError);
    expect(order).toEqual(['session_logs:s1', 'set_logs:a', 'set_logs:b']);
  });

  it('renvoyer une opération déjà reçue ne crée pas de doublon (upsert)', async () => {
    const store = createMemoryStore();
    const { remote, rows } = fakeRemote();
    await enqueue(
      store,
      { table: 'set_logs', kind: 'upsert', payload: { id: 'x1', reps: 8 } },
      makeId,
    );
    await flushOutbox(store, remote, isNetworkError);
    await enqueue(
      store,
      { table: 'set_logs', kind: 'upsert', payload: { id: 'x1', reps: 8 } },
      makeId,
    );
    await flushOutbox(store, remote, isNetworkError);
    expect([...rows.keys()]).toEqual(['set_logs:x1']);
  });

  it('une erreur serveur n’empêche pas l’envoi des autres opérations, et est retentée', async () => {
    const store = createMemoryStore();
    const { remote, rows, state } = fakeRemote();
    state.rejectIds.add('bad');
    await enqueue(store, { table: 'set_logs', kind: 'upsert', payload: { id: 'bad' } }, makeId);
    await enqueue(store, { table: 'set_logs', kind: 'upsert', payload: { id: 'good' } }, makeId);
    const r = await flushOutbox(store, remote, isNetworkError);
    expect(r).toMatchObject({ sent: 1, failed: 1, remaining: 1 });
    expect(rows.has('set_logs:good')).toBe(true);
    const [op] = await store.listOutbox();
    expect(op).toMatchObject({ attempts: 1, lastError: 'refusé par le serveur' });

    // Après MAX_ATTEMPTS échecs, l'opération est mise de côté (plus retentée).
    for (let i = 1; i < MAX_ATTEMPTS; i++) await flushOutbox(store, remote, isNetworkError);
    const calls = state.calls;
    await flushOutbox(store, remote, isNetworkError);
    expect(state.calls).toBe(calls);
    expect(await pendingCount(store)).toBe(1);
  });

  it('gère les suppressions et les coupures pendant une suppression', async () => {
    const store = createMemoryStore();
    const { remote, rows, state } = fakeRemote();
    await enqueue(
      store,
      { table: 'body_weights', kind: 'upsert', payload: { id: 'w1', weight_kg: 70 } },
      makeId,
    );
    await flushOutbox(store, remote, isNetworkError);
    await enqueue(store, { table: 'body_weights', kind: 'delete', payload: { id: 'w1' } }, makeId);
    state.offline = true;
    expect((await flushOutbox(store, remote, isNetworkError)).offline).toBe(true);
    state.offline = false;
    await flushOutbox(store, remote, isNetworkError);
    expect(rows.size).toBe(0);
  });

  it('prévient l’interface à chaque changement', async () => {
    const store = createMemoryStore();
    const fn = jest.fn();
    const off = onOutboxChange(fn);
    await enqueue(store, { table: 'checkins', kind: 'upsert', payload: { id: 'c1' } }, makeId);
    off();
    await enqueue(store, { table: 'checkins', kind: 'upsert', payload: { id: 'c2' } }, makeId);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('séance supprimée par le coach', () => {
  it('retire la séance, ses séries et ses records de la file, et rien d’autre', async () => {
    const store = createMemoryStore();
    const up = (
      table: Parameters<typeof enqueue>[1]['table'],
      payload: { id: string } & Record<string, unknown>,
    ) => enqueue(store, { table, kind: 'upsert', payload }, makeId);
    await up('session_logs', { id: 's1', status: 'in_progress' });
    await up('set_logs', { id: 'x1', session_log_id: 's1', reps: 8 });
    await up('personal_records', { id: 'r1', session_log_id: 's1' });
    await up('session_logs', { id: 's2' });
    await up('set_logs', { id: 'x2', session_log_id: 's2' });
    await up('body_weights', { id: 'w1', weight_kg: 70 });

    expect([...(await sessionIdsInOutbox(store))].sort()).toEqual(['s1', 's2']);
    expect(await dropSessionOps(store, new Set(['s1']))).toBe(3);
    const left = (await store.listOutbox()).map((o) => o.payload.id).sort();
    expect(left).toEqual(['s2', 'w1', 'x2']);
    expect(await dropSessionOps(store, new Set())).toBe(0);
  });
});
