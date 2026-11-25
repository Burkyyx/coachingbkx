import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays, sumMacros } from '@/core';
import { supabase, type Enums, type Tables } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';

export type MealType = Enums<'meal_type'>;
export type MealSource = Enums<'meal_source'>;
export type MealItem = Tables<'meal_items'>;
export type Meal = Tables<'meals'> & { items: MealItem[] };

export const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export type ItemInput = {
  name: string;
  quantityG: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence?: Enums<'ai_confidence'> | null;
  barcode?: string | null;
};

const mealKeys = {
  all: (adherentId: string) => ['nutrition', 'meals', adherentId] as const,
  range: (adherentId: string, from: string, to: string) =>
    ['nutrition', 'meals', adherentId, from, to] as const,
  recent: (adherentId: string) => ['nutrition', 'meals', adherentId, 'recent'] as const,
};

/** Début de journée locale (appareil) en ISO, pour filtrer sur eaten_at. */
function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

/** Repas (avec aliments) entre deux dates incluses (AAAA-MM-JJ). */
export function useMealsRange(adherentId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: mealKeys.range(adherentId ?? '', from, to),
    enabled: adherentId !== null,
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('*, items:meal_items(*)')
        .eq('adherent_id', adherentId as string)
        .gte('eaten_at', startOfDayIso(from))
        .lt('eaten_at', startOfDayIso(addDays(to, 1)))
        .order('eaten_at');
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        items: [...(m.items ?? [])].sort((a, b) => a.position - b.position),
      }));
    },
  });
}

/** Repas récents et favoris, pour les réajouter en un geste (sans doublons). */
export function useRecentMeals(adherentId: string | null) {
  return useQuery({
    queryKey: mealKeys.recent(adherentId ?? ''),
    enabled: adherentId !== null,
    queryFn: async (): Promise<Meal[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('*, items:meal_items(*)')
        .eq('adherent_id', adherentId as string)
        .order('eaten_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      const seen = new Set<string>();
      const out: Meal[] = [];
      const meals = (data ?? []).map((m) => ({ ...m, items: m.items ?? [] }));
      for (const m of [...meals.filter((x) => x.is_favorite), ...meals]) {
        const signature =
          m.items.length > 0
            ? m.items
                .map((i) => `${i.name}:${i.quantity_g ?? ''}`)
                .sort()
                .join('|')
            : `${m.description ?? ''}:${m.kcal}`;
        if (seen.has(signature) || (m.items.length === 0 && !m.description)) continue;
        seen.add(signature);
        out.push(m);
      }
      return out.slice(0, 25);
    },
  });
}

export type NewMeal = {
  mealType: MealType;
  eatenAt: string;
  description?: string | null;
  source: MealSource;
  photoPath?: string | null;
  analysisStatus?: Enums<'meal_analysis_status'>;
  analysisNote?: string | null;
  items: ItemInput[];
  /** Repas « ajout rapide » sans aliment détaillé. */
  totals?: { kcal: number; proteinG: number; carbsG?: number; fatG?: number };
  id?: string;
};

export function useMealActions(adherentId: string) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: mealKeys.all(adherentId) });

  const add = useMutation({
    mutationFn: async (meal: NewMeal) => {
      const id = meal.id ?? uuid();
      const totals = meal.totals ? { carbsG: 0, fatG: 0, ...meal.totals } : sumMacros(meal.items);
      const { error } = await supabase.from('meals').insert({
        id,
        adherent_id: adherentId,
        eaten_at: meal.eatenAt,
        meal_type: meal.mealType,
        description: meal.description?.trim() || null,
        source: meal.source,
        photo_path: meal.photoPath ?? null,
        analysis_status: meal.analysisStatus ?? 'none',
        analysis_note: meal.analysisNote ?? null,
        kcal: round1(totals.kcal),
        protein_g: round1(totals.proteinG),
        carbs_g: round1(totals.carbsG),
        fat_g: round1(totals.fatG),
        validated: true,
      });
      if (error) throw error;
      if (meal.items.length > 0) {
        const { error: itemsError } = await supabase.from('meal_items').insert(
          meal.items.map((it, position) => ({
            id: uuid(),
            meal_id: id,
            adherent_id: adherentId,
            position,
            name: it.name.trim().slice(0, 120) || '—',
            quantity_g: it.quantityG,
            kcal: round1(it.kcal),
            protein_g: round1(it.proteinG),
            carbs_g: round1(it.carbsG),
            fat_g: round1(it.fatG),
            confidence: it.confidence ?? null,
            barcode: it.barcode ?? null,
          })),
        );
        if (itemsError) {
          await supabase.from('meals').delete().eq('id', id);
          throw itemsError;
        }
      }
      return id;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (meal: Pick<Meal, 'id' | 'photo_path'>) => {
      if (meal.photo_path) await supabase.storage.from('meal-photos').remove([meal.photo_path]);
      const { error } = await supabase.from('meals').delete().eq('id', meal.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const setFavorite = useMutation({
    mutationFn: async ({ id, favorite }: { id: string; favorite: boolean }) => {
      const { error } = await supabase.from('meals').update({ is_favorite: favorite }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  /** Réajoute un repas existant (récent / favori) à une autre date ou un autre moment. */
  const copy = (meal: Meal, mealType: MealType, eatenAt: string) =>
    add.mutateAsync({
      mealType,
      eatenAt,
      description: meal.description,
      source: 'copy',
      items: meal.items.map((i) => ({
        name: i.name,
        quantityG: i.quantity_g === null ? null : Number(i.quantity_g),
        kcal: Number(i.kcal),
        proteinG: Number(i.protein_g),
        carbsG: Number(i.carbs_g),
        fatG: Number(i.fat_g),
        barcode: i.barcode,
      })),
      totals:
        meal.items.length === 0
          ? {
              kcal: Number(meal.kcal),
              proteinG: Number(meal.protein_g),
              carbsG: Number(meal.carbs_g),
              fatG: Number(meal.fat_g),
            }
          : undefined,
    });

  return { add, remove, setFavorite, copy };
}

function round1(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
}

/** Totaux d'un repas (colonnes numériques renvoyées en chaînes par Postgres). */
export function mealTotals(m: Pick<Meal, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>) {
  return {
    kcal: Number(m.kcal),
    proteinG: Number(m.protein_g),
    carbsG: Number(m.carbs_g),
    fatG: Number(m.fat_g),
  };
}
