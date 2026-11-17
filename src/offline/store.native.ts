import * as SQLite from 'expo-sqlite';

import type { LocalStore, OutboxOp } from './types';

/**
 * Stockage local sur iPhone / Android : base SQLite « elan.db ».
 * (Nom technique historique, ancien nom de l'app : ne pas renommer, sinon perte des données locales.)
 *  - docs   : documents JSON (programme, historique, séance en cours…)
 *  - outbox : opérations à envoyer au serveur, dans l'ordre (colonne seq)
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= 1) return;
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        op_id TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL
      );
      PRAGMA user_version = 1;
    `);
  });
}

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('elan.db').then(async (d) => {
      await migrate(d);
      return d;
    });
  }
  return dbPromise;
}

export const localStore: LocalStore = {
  async getDoc<T>(key: string) {
    const row = await (
      await db()
    ).getFirstAsync<{ value: string }>('SELECT value FROM docs WHERE key = ?', key);
    return row ? (JSON.parse(row.value) as T) : null;
  },
  async setDoc(key, value) {
    await (
      await db()
    ).runAsync(
      'INSERT INTO docs (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  },
  async deleteDoc(key) {
    await (await db()).runAsync('DELETE FROM docs WHERE key = ?', key);
  },
  async listOutbox() {
    const rows = await (
      await db()
    ).getAllAsync<{ data: string }>('SELECT data FROM outbox ORDER BY seq');
    return rows.map((r) => JSON.parse(r.data) as OutboxOp);
  },
  async putOutbox(op) {
    await (
      await db()
    ).runAsync(
      'INSERT INTO outbox (op_id, data) VALUES (?, ?) ON CONFLICT(op_id) DO UPDATE SET data = excluded.data',
      op.opId,
      JSON.stringify(op),
    );
  },
  async removeOutbox(opId) {
    await (await db()).runAsync('DELETE FROM outbox WHERE op_id = ?', opId);
  },
  async clearAll() {
    await (await db()).execAsync('DELETE FROM docs; DELETE FROM outbox;');
  },
};
