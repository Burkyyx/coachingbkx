import { useQuery } from '@tanstack/react-query';

import { todayLocal, weekStart } from '@/core';
import { isNetworkError } from '@/lib/errors';
import { supabase, type Tables } from '@/lib/supabase';
import { uploadFile } from '@/lib/storage';
import { stableUuid } from '@/lib/uuid';
import { saveOffline } from '@/offline/sync';

export type Checkin = Tables<'checkins'>;

/** Bilans de l'adhérent connecté (les plus récents d'abord). */
export function useMyCheckins(uid: string | null) {
  return useQuery({
    queryKey: ['my-checkins', uid],
    enabled: uid !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('adherent_id', uid as string)
        .order('week_start', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export type CheckinInput = {
  weightKg: number | null;
  waistCm: number | null;
  sleep: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
  comment: string;
  photoUris: string[];
  existingPhotoPaths: string[];
};

/**
 * Enregistre le bilan de la semaine (fonctionne hors-ligne ; les photos, elles,
 * nécessitent une connexion). Le poids est aussi enregistré comme pesée du jour.
 */
export async function saveCheckin(
  uid: string,
  input: CheckinInput,
): Promise<{ photosSkipped: boolean }> {
  const week = weekStart(todayLocal());
  const id = await stableUuid(`checkin:${uid}:${week}`);
  let photoPaths = [...input.existingPhotoPaths];
  let photosSkipped = false;
  for (const [i, uri] of input.photoUris.entries()) {
    const path = `${uid}/${id}/${Date.now()}-${i}.jpg`;
    try {
      await uploadFile('checkin-photos', path, uri, 'image/jpeg');
      photoPaths = [...photoPaths, path];
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      photosSkipped = true;
    }
  }
  await saveOffline('checkins', {
    id,
    adherent_id: uid,
    week_start: week,
    weight_kg: input.weightKg,
    waist_cm: input.waistCm,
    sleep: input.sleep,
    energy: input.energy,
    stress: input.stress,
    soreness: input.soreness,
    comment: input.comment.trim() || null,
    photo_paths: photoPaths,
    submitted_at: new Date().toISOString(),
  });
  if (input.weightKg !== null) await saveWeight(uid, input.weightKg);
  return { photosSkipped };
}

/** Pesée du jour (une par jour : la dernière saisie remplace la précédente). */
export async function saveWeight(uid: string, weightKg: number, date = todayLocal()) {
  const id = await stableUuid(`weight:${uid}:${date}`);
  await saveOffline('body_weights', {
    id,
    adherent_id: uid,
    measured_on: date,
    weight_kg: weightKg,
  });
}
