import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Export RGPD : toutes les données de l'utilisateur en JSON, plus un fichier
 * CSV des séries (lisible dans Excel / Numbers).
 */

type ExportJson = { set_logs?: Record<string, unknown>[] } & Record<string, unknown>;

/** Échappe une valeur pour le CSV (séparateur point-virgule, format français). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function setsToCsv(sets: readonly Record<string, unknown>[]): string {
  const columns = [
    'performed_at',
    'exercise_name',
    'set_type',
    'load_kg',
    'reps',
    'rir',
    'rpe',
    'rest_seconds_actual',
    'rest_seconds_prescribed',
    'completed',
    'note',
  ];
  const header = [
    'date',
    'exercice',
    'type',
    'charge_kg',
    'reps',
    'rir',
    'rpe',
    'repos_reel_s',
    'repos_prevu_s',
    'validee',
    'note',
  ];
  const lines = sets.map((s) => columns.map((c) => csvCell(s[c])).join(';'));
  return [header.join(';'), ...lines].join('\n');
}

function downloadOnWeb(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportMyData(): Promise<void> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  const json = JSON.stringify(data, null, 2);
  const csv = setsToCsv(((data as ExportJson | null)?.set_logs ?? []) as Record<string, unknown>[]);
  const stamp = new Date().toISOString().slice(0, 10);

  if (Platform.OS === 'web') {
    downloadOnWeb(`mes-donnees-${stamp}.json`, json, 'application/json');
    downloadOnWeb(`mes-series-${stamp}.csv`, `﻿${csv}`, 'text/csv;charset=utf-8');
    return;
  }
  const jsonFile = new File(Paths.cache, `mes-donnees-${stamp}.json`);
  jsonFile.write(json);
  const csvFile = new File(Paths.cache, `mes-series-${stamp}.csv`);
  csvFile.write(`﻿${csv}`);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(jsonFile.uri, { mimeType: 'application/json' });
    await Sharing.shareAsync(csvFile.uri, { mimeType: 'text/csv' });
  }
}

/** Suppression définitive du compte (fichiers + données), via la fonction serveur. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
}
