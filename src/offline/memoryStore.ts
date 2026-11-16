import type { LocalStore, OutboxOp } from './types';

/** Stockage en mémoire (tests automatisés). */
export function createMemoryStore(): LocalStore {
  const docs = new Map<string, string>();
  let outbox: OutboxOp[] = [];
  return {
    async getDoc<T>(key: string) {
      const raw = docs.get(key);
      return raw === undefined ? null : (JSON.parse(raw) as T);
    },
    async setDoc(key, value) {
      docs.set(key, JSON.stringify(value));
    },
    async deleteDoc(key) {
      docs.delete(key);
    },
    async listOutbox() {
      return outbox.map((op) => ({ ...op }));
    },
    async putOutbox(op) {
      const i = outbox.findIndex((o) => o.opId === op.opId);
      if (i >= 0) outbox[i] = { ...op };
      else outbox.push({ ...op });
    },
    async removeOutbox(opId) {
      outbox = outbox.filter((o) => o.opId !== opId);
    },
    async clearAll() {
      docs.clear();
      outbox = [];
    },
  };
}
