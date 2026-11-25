import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { programWeekIndex, todayLocal, type PlannedSessionInput } from '@/core';
import { fetchProgramTree } from '@/features/programs/api';
import { supabase, type Tables, type TablesInsert } from '@/lib/supabase';

export type NutritionTargetsRow = Tables<'nutrition_targets'>;

export const nutritionKeys = {
  targets: (adherentId: string) => ['nutrition', 'targets', adherentId] as const,
  plannedWeek: (adherentId: string) => ['nutrition', 'planned-week', adherentId] as const,
};

/** Objectifs nutrition d'un adhérent (null si le coach ne les a pas encore définis). */
export function useNutritionTargets(adherentId: string | null) {
  return useQuery({
    queryKey: nutritionKeys.targets(adherentId ?? ''),
    enabled: adherentId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nutrition_targets')
        .select('*')
        .eq('adherent_id', adherentId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveNutritionTargets(adherentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Omit<TablesInsert<'nutrition_targets'>, 'adherent_id'>) => {
      const { error } = await supabase
        .from('nutrition_targets')
        .upsert({ ...values, adherent_id: adherentId });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: nutritionKeys.targets(adherentId) }),
  });
}

/**
 * Séances prévues sur la semaine en cours du programme actif de l'adhérent
 * (pour estimer la dépense liée au sport). Semaine vide si aucun programme.
 */
export function usePlannedWeek(adherentId: string) {
  return useQuery({
    queryKey: nutritionKeys.plannedWeek(adherentId),
    queryFn: async (): Promise<{ programName: string | null; sessions: PlannedSessionInput[] }> => {
      const { data: programs, error } = await supabase
        .from('programs')
        .select('id, name, start_date, duration_weeks')
        .eq('adherent_id', adherentId)
        .eq('kind', 'assigned')
        .eq('status', 'active')
        .order('start_date', { ascending: false })
        .limit(1);
      if (error) throw error;
      const program = programs?.[0];
      if (!program?.start_date) return { programName: null, sessions: [] };

      const [tree, exercises] = await Promise.all([
        fetchProgramTree(program.id),
        supabase.from('exercises').select('id, type'),
      ]);
      if (exercises.error) throw exercises.error;
      const cardio = new Set(
        (exercises.data ?? []).filter((e) => e.type === 'cardio').map((e) => e.id),
      );
      const week = Math.min(
        Math.max(1, programWeekIndex(program.start_date, todayLocal())),
        program.duration_weeks,
      );
      const sessions = tree.workouts
        .filter((w) => w.week_index === week)
        .map((w) => ({
          sets: w.exercises.flatMap((we) =>
            we.sets.map((s) => ({
              restSeconds: s.rest_seconds,
              durationSeconds: s.duration_seconds,
              cardio: cardio.has(we.exercise_id),
            })),
          ),
        }))
        .filter((s) => s.sets.length > 0);
      return { programName: program.name, sessions };
    },
  });
}
