import type { LocalStore, OutboxOp } from './types';

/**
 * Stockage local sur le web : stockage du navigateur (localStorage).
 * Les données restent sur l'appareil même sans réseau (et après fermeture de l'onglet).
 * Sur iPhone / Android, c'est store.native.ts (SQLite) qui est utilisé.
 */
const DOC_PREFIX = 'elan:doc:';
const OUTBOX_KEY = 'elan:outbox';

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

// Repli en mémoire si le stockage du navigateur est indisponible (navigation privée…).
const memory = new Map<string, string>();
function read(key: string): string | null {
  const s = storage();
  return s ? s.getItem(key) : (memory.get(key) ?? null);
}
function write(key: string, value: string | null) {
  const s = storage();
  if (s) {
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } else if (value === null) memory.delete(key);
  else memory.set(key, value);
}

function readOutbox(): OutboxOp[] {
  const raw = read(OUTBOX_KEY);
  return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
}

export const localStore: LocalStore = {
  async getDoc<T>(key: string) {
    const raw = read(DOC_PREFIX + key);
    return raw === null ? null : (JSON.parse(raw) as T);
  },
  async setDoc(key, value) {
    write(DOC_PREFIX + key, JSON.stringify(value));
  },
  async deleteDoc(key) {
    write(DOC_PREFIX + key, null);
  },
  async listOutbox() {
    return readOutbox();
  },
  async putOutbox(op) {
    const list = readOutbox();
    const i = list.findIndex((o) => o.opId === op.opId);
    if (i >= 0) list[i] = op;
    else list.push(op);
    write(OUTBOX_KEY, JSON.stringify(list));
  },
  async removeOutbox(opId) {
    write(OUTBOX_KEY, JSON.stringify(readOutbox().filter((o) => o.opId !== opId)));
  },
  async clearAll() {
    const s = storage();
    if (s) {
      for (const key of Object.keys(s)) if (key.startsWith('elan:')) s.removeItem(key);
    }
    memory.clear();
  },
};
