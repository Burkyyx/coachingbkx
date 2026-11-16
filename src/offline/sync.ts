import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { isNetworkError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';

import {
  enqueue,
  flushOutbox,
  onOutboxChange,
  pendingCount,
  type FlushResult,
  type Remote,
} from './outbox';
import { localStore } from './store';
import type { SyncedTable } from './types';

/** État de la synchronisation, affiché dans l'interface. */
type SyncState = {
  pending: number;
  syncing: boolean;
  online: boolean;
  lastSyncedAt: string | null;
  set: (patch: Partial<Omit<SyncState, 'set'>>) => void;
};

export const useSyncStatus = create<SyncState>()((set) => ({
  pending: 0,
  syncing: false,
  online: true,
  lastSyncedAt: null,
  set: (patch) => set(patch),
}));

const remote: Remote = {
  async upsert(table, row) {
    // Les tables synchronisées ont toutes une colonne `id` générée sur l'appareil.
    const { error } = await supabase.from(table).upsert(row as never, { onConflict: 'id' });
    return { error };
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    return { error };
  },
};

/** Enregistre une écriture localement et la met dans la file d'envoi. */
export async function saveOffline(
  table: SyncedTable,
  payload: { id: string } & Record<string, unknown>,
) {
  await enqueue(localStore, { table, kind: 'upsert', payload }, uuid);
}

export async function deleteOffline(table: SyncedTable, id: string) {
  await enqueue(localStore, { table, kind: 'delete', payload: { id } }, uuid);
}

let running: Promise<FlushResult> | null = null;
const afterSync = new Set<(r: FlushResult) => void>();

/** Appelé après chaque synchronisation réussie (ex. rafraîchir les données). */
export function onSynced(fn: (r: FlushResult) => void): () => void {
  afterSync.add(fn);
  return () => afterSync.delete(fn);
}

/** Envoie maintenant ce qui est en attente (une seule synchro à la fois). */
export function syncNow(): Promise<FlushResult> {
  if (running) return running;
  const status = useSyncStatus.getState();
  status.set({ syncing: true });
  running = (async () => {
    try {
      const result = await flushOutbox(localStore, remote, isNetworkError);
      status.set({
        pending: result.remaining,
        online: !result.offline,
        lastSyncedAt: result.sent > 0 ? new Date().toISOString() : status.lastSyncedAt,
      });
      if (result.sent > 0) for (const fn of afterSync) fn(result);
      return result;
    } finally {
      status.set({ syncing: false });
      running = null;
    }
  })();
  return running;
}

async function refreshCount() {
  useSyncStatus.getState().set({ pending: await pendingCount(localStore) });
}

/**
 * Gestionnaire de synchronisation (monté une fois dans l'espace adhérent) :
 * envoie la file au démarrage, au retour du réseau, au retour au premier plan,
 * après chaque nouvelle écriture, et toutes les 20 s tant qu'il reste des éléments.
 */
export function useSyncManager() {
  useEffect(() => {
    void refreshCount().then(() => syncNow());
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const offChange = onOutboxChange(() => {
      void refreshCount();
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void syncNow(), 800);
    });
    const offNet = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      useSyncStatus.getState().set({ online });
      if (online) void syncNow();
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    const interval = setInterval(() => {
      if (useSyncStatus.getState().pending > 0) void syncNow();
    }, 20_000);
    return () => {
      offChange();
      offNet();
      appState.remove();
      clearInterval(interval);
      if (debounce) clearTimeout(debounce);
    };
  }, []);
}
