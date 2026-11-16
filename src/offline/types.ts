/**
 * HORS-LIGNE — types communs.
 *
 * Toutes les écritures de l'adhérent (séances, séries, records, bilans, pesées)
 * passent par une file d'attente locale (« outbox ») avant d'être envoyées au
 * serveur. Les identifiants sont générés sur l'appareil : renvoyer deux fois la
 * même opération ne crée jamais de doublon (envoi en « upsert »).
 */

export type SyncedTable =
  'session_logs' | 'set_logs' | 'personal_records' | 'checkins' | 'body_weights';

export type OutboxOp = {
  /** Identifiant de l'opération dans la file. */
  opId: string;
  table: SyncedTable;
  kind: 'upsert' | 'delete';
  /** Ligne à envoyer (contient toujours `id`). */
  payload: { id: string } & Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

/** Stockage local : documents JSON + file d'attente ordonnée. */
export interface LocalStore {
  getDoc<T>(key: string): Promise<T | null>;
  setDoc<T>(key: string, value: T): Promise<void>;
  deleteDoc(key: string): Promise<void>;
  /** Opérations en attente, dans l'ordre d'arrivée. */
  listOutbox(): Promise<OutboxOp[]>;
  putOutbox(op: OutboxOp): Promise<void>;
  removeOutbox(opId: string): Promise<void>;
  clearAll(): Promise<void>;
}
