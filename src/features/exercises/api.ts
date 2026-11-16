import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase, type Enums, type Tables, type TablesInsert } from '@/lib/supabase';

export type Exercise = Tables<'exercises'>;
export type MuscleGroup = Enums<'muscle_group'>;
export type Equipment = Enums<'equipment'>;
export type ExerciseType = Enums<'exercise_type'>;

export const MUSCLES: readonly MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'shoulders',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lower_back',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'abductors',
  'calves',
  'full_body',
  'cardio',
];
export const EQUIPMENTS: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'smith',
  'ez_bar',
  'cardio_machine',
  'other',
];
export const EXERCISE_TYPES: readonly ExerciseType[] = [
  'free_weight',
  'machine',
  'bodyweight',
  'cardio',
  'timed',
];

const LOWER_BODY: readonly MuscleGroup[] = [
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
];

/** Incrément par défaut selon la spec : 2,5 kg haut du corps, 5 kg bas du corps, 2 kg haltères. */
export function defaultIncrement(muscle: MuscleGroup, equipment: Equipment): number {
  if (equipment === 'dumbbell') return 2;
  return LOWER_BODY.includes(muscle) ? 5 : 2.5;
}

/** Vrai si la charge a un sens pour cet exercice (suggestions de charge). */
export function isLoadable(type: ExerciseType): boolean {
  return type === 'free_weight' || type === 'machine';
}

const keys = {
  all: ['exercises'] as const,
  alternatives: ['exercise-alternatives'] as const,
};

/** Toute la bibliothèque (triée par nom). */
export function useExercises() {
  return useQuery({
    queryKey: keys.all,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Alternatives : exercice → liste d'exercices de remplacement. */
export function useAlternatives() {
  return useQuery({
    queryKey: keys.alternatives,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_alternatives').select('*');
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const row of data) {
        map.set(row.exercise_id, [...(map.get(row.exercise_id) ?? []), row.alternative_id]);
      }
      return map;
    },
  });
}

/** Recherche insensible aux accents et à la casse. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filterExercises(
  list: readonly Exercise[],
  {
    search,
    muscle,
    includeArchived,
  }: { search: string; muscle: MuscleGroup | null; includeArchived: boolean },
): Exercise[] {
  const q = normalizeSearch(search);
  return list.filter(
    (e) =>
      (includeArchived || e.archived_at === null) &&
      (muscle === null || e.primary_muscle === muscle || e.secondary_muscles.includes(muscle)) &&
      (q === '' || normalizeSearch(e.name).includes(q)),
  );
}

export function useSaveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
      alternatives,
    }: {
      id: string | null;
      values: Omit<TablesInsert<'exercises'>, 'id'>;
      alternatives: string[];
    }) => {
      let exerciseId = id;
      if (exerciseId) {
        const { error } = await supabase.from('exercises').update(values).eq('id', exerciseId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('exercises')
          .insert(values)
          .select('id')
          .single();
        if (error) throw error;
        exerciseId = data.id;
      }
      // Alternatives : on remplace la liste (dans les deux sens).
      const del = await supabase
        .from('exercise_alternatives')
        .delete()
        .or(`exercise_id.eq.${exerciseId},alternative_id.eq.${exerciseId}`);
      if (del.error) throw del.error;
      if (alternatives.length > 0) {
        const rows = alternatives.flatMap((alt) => [
          { exercise_id: exerciseId as string, alternative_id: alt },
          { exercise_id: alt, alternative_id: exerciseId as string },
        ]);
        const ins = await supabase.from('exercise_alternatives').upsert(rows);
        if (ins.error) throw ins.error;
      }
      return exerciseId;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.alternatives });
    },
  });
}

export function useArchiveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('exercises')
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
