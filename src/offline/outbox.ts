import type { LocalStore, OutboxOp, SyncedTable } from './types';

/** Après ce nombre d'échecs (hors coupure réseau), l'opération est mise de côté. */
export const MAX_ATTEMPTS = 5;

/** Accès au serveur (injecté : Supabase dans l'app, faux serveur dans les tests). */
export type Remote = {
  upsert(table: SyncedTable, row: Record<string, unknown>): Promise<{ error: unknown }>;
  remove(table: SyncedTable, id: string): Promise<{ error: unknown }>;
};

type Listener = () => void;
const listeners = new Set<Listener>();
/** Prévenir l'interface qu'une opération a été ajoutée ou envoyée. */
export function onOutboxChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

/**
 * Ajoute une écriture à la file d'attente.
 * Si une écriture du même élément attend déjà, elle est fusionnée (dernière valeur gagnante),
 * ce qui évite d'envoyer 10 fois une série modifiée 10 fois hors-ligne.
 */
export async function enqueue(
  store: LocalStore,
  op: { table: SyncedTable; kind: 'upsert' | 'delete'; payload: OutboxOp['payload'] },
  makeId: () => string,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  const pending = await store.listOutbox();
  const same = pending.find(
    (o) => o.table === op.table && o.payload.id === op.payload.id && o.attempts < MAX_ATTEMPTS,
  );
  if (same && same.kind === 'upsert' && op.kind === 'upsert') {
    await store.putOutbox({ ...same, payload: { ...same.payload, ...op.payload } });
  } else {
    await store.putOutbox({
      opId: makeId(),
      table: op.table,
      kind: op.kind,
      payload: op.payload,
      createdAt: now(),
      attempts: 0,
      lastError: null,
    });
  }
  emit();
}

export type FlushResult = {
  sent: number;
  failed: number;
  /** Opérations encore en attente (y compris celles mises de côté). */
  remaining: number;
  /** Vrai si l'envoi s'est arrêté faute de réseau. */
  offline: boolean;
};

/**
 * Envoie les opérations en attente, dans l'ordre. S'arrête dès qu'il n'y a plus
 * de réseau (les opérations restent dans la file pour plus tard).
 */
export async function flushOutbox(
  store: LocalStore,
  remote: Remote,
  isNetworkError: (e: unknown) => boolean,
): Promise<FlushResult> {
  const ops = await store.listOutbox();
  let sent = 0;
  let failed = 0;
  let offline = false;
  for (const op of ops) {
    if (op.attempts >= MAX_ATTEMPTS) continue;
    let error: unknown = null;
    try {
      const res =
        op.kind === 'upsert'
          ? await remote.upsert(op.table, op.payload)
          : await remote.remove(op.table, op.payload.id);
      error = res.error;
    } catch (e) {
      error = e;
    }
    if (!error) {
      await store.removeOutbox(op.opId);
      sent++;
      continue;
    }
    if (isNetworkError(error)) {
      offline = true;
      break;
    }
    failed++;
    const message = (error as { message?: string }).message ?? String(error);
    await store.putOutbox({ ...op, attempts: op.attempts + 1, lastError: message.slice(0, 300) });
  }
  const remaining = (await store.listOutbox()).length;
  if (sent > 0 || failed > 0) emit();
  return { sent, failed, remaining, offline };
}

/** Nombre d'opérations en attente d'envoi. */
export async function pendingCount(store: LocalStore): Promise<number> {
  return (await store.listOutbox()).length;
}
