import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase, type Enums, type Tables, type TablesUpdate } from '@/lib/supabase';

export type Program = Tables<'programs'>;
export type Workout = Tables<'workouts'>;
export type WorkoutExercise = Tables<'workout_exercises'>;
export type PrescribedSet = Tables<'prescribed_sets'>;
export type WeekAdjustment = Tables<'program_week_adjustments'>;
export type SetType = Enums<'set_type'>;
export type ProgramStatus = Enums<'program_status'>;

export const SET_TYPES: readonly SetType[] = [
  'warmup',
  'working',
  'drop',
  'failure',
  'backoff',
  'amrap',
];
export const PROGRAM_STATUSES: readonly ProgramStatus[] = [
  'draft',
  'active',
  'completed',
  'archived',
];

export type ExerciseNode = WorkoutExercise & { sets: PrescribedSet[] };
export type WorkoutNode = Workout & { exercises: ExerciseNode[] };
export type ProgramTree = {
  program: Program;
  adherent: { id: string; first_name: string | null; last_name: string | null } | null;
  workouts: WorkoutNode[];
  adjustments: WeekAdjustment[];
};

export const programKeys = {
  list: (kind: 'template' | 'assigned') => ['programs', kind] as const,
  tree: (id: string) => ['program-tree', id] as const,
  adherents: ['adherents', 'active'] as const,
};

/** Liste des modèles ou des programmes assignés. */
export function usePrograms(kind: 'template' | 'assigned') {
  return useQuery({
    queryKey: programKeys.list(kind),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select(
          '*, workouts(count), adherent:profiles!programs_adherent_id_fkey(first_name, last_name)',
        )
        .eq('kind', kind)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Charge un programme complet : séances → exercices → séries. */
export async function fetchProgramTree(id: string): Promise<ProgramTree> {
  const [p, w, we, ps, adj] = await Promise.all([
    supabase
      .from('programs')
      .select('*, adherent:profiles!programs_adherent_id_fkey(id, first_name, last_name)')
      .eq('id', id)
      .single(),
    supabase.from('workouts').select('*').eq('program_id', id),
    supabase.from('workout_exercises').select('*').eq('program_id', id),
    supabase.from('prescribed_sets').select('*').eq('program_id', id),
    supabase.from('program_week_adjustments').select('*').eq('program_id', id),
  ]);
  for (const r of [p, w, we, ps, adj]) if (r.error) throw r.error;
  const { adherent, ...program } = p.data as Program & { adherent: ProgramTree['adherent'] };

  const setsByWe = new Map<string, PrescribedSet[]>();
  for (const s of ps.data ?? [])
    setsByWe.set(s.workout_exercise_id, [...(setsByWe.get(s.workout_exercise_id) ?? []), s]);
  const exByWorkout = new Map<string, ExerciseNode[]>();
  for (const e of we.data ?? []) {
    const node: ExerciseNode = {
      ...e,
      sets: (setsByWe.get(e.id) ?? []).sort((a, b) => a.position - b.position),
    };
    exByWorkout.set(e.workout_id, [...(exByWorkout.get(e.workout_id) ?? []), node]);
  }
  const workouts: WorkoutNode[] = (w.data ?? [])
    .map((x) => ({
      ...x,
      exercises: (exByWorkout.get(x.id) ?? []).sort((a, b) => a.position - b.position),
    }))
    .sort(
      (a, b) =>
        a.week_index - b.week_index || a.day_of_week - b.day_of_week || a.position - b.position,
    );

  return { program, adherent, workouts, adjustments: adj.data ?? [] };
}

export function useProgramTree(id: string) {
  return useQuery({ queryKey: programKeys.tree(id), queryFn: () => fetchProgramTree(id) });
}

/** Adhérents actifs (pour l'assignation). */
export function useActiveAdherents() {
  return useQuery({
    queryKey: programKeys.adherents,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .eq('role', 'adherent')
        .eq('is_active', true)
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('programs')
        .insert({ kind: 'template', name, duration_weeks: 4 })
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['programs'] }),
  });
}

export function useAssignProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      sourceId: string;
      adherentIds: string[];
      startDate: string;
      activate: boolean;
    }) => {
      const { data, error } = await supabase.rpc('assign_program', {
        p_source: args.sourceId,
        p_adherents: args.adherentIds,
        p_start: args.startDate,
        p_activate: args.activate,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['programs'] }),
  });
}

export function useDuplicateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('duplicate_program', {
        p_program: id,
        p_as_template: true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['programs'] }),
  });
}

function check<T extends { error: unknown }>(r: T): T {
  if (r.error) throw r.error;
  return r;
}

/**
 * Toutes les actions du constructeur de programmes. Chaque action enregistre
 * immédiatement en base puis rafraîchit l'arbre du programme.
 */
export function useProgramActions(programId: string, onChange?: () => void) {
  const qc = useQueryClient();
  const refresh = async () => {
    onChange?.();
    await qc.invalidateQueries({ queryKey: programKeys.tree(programId) });
  };
  const tree = () => qc.getQueryData<ProgramTree>(programKeys.tree(programId));

  return {
    async updateProgram(patch: TablesUpdate<'programs'>) {
      check(await supabase.from('programs').update(patch).eq('id', programId));
      await refresh();
      void qc.invalidateQueries({ queryKey: ['programs'] });
    },
    async deleteProgram() {
      check(await supabase.from('programs').delete().eq('id', programId));
      void qc.invalidateQueries({ queryKey: ['programs'] });
    },
    async addWeek() {
      const t = tree();
      if (!t) return;
      await this.updateProgram({ duration_weeks: Math.min(52, t.program.duration_weeks + 1) });
    },
    async duplicateWeek(from: number) {
      const t = tree();
      if (!t) return;
      check(
        await supabase.rpc('duplicate_week', {
          p_program: programId,
          p_from: from,
          p_to: t.program.duration_weeks + 1,
        }),
      );
      await refresh();
    },
    async deleteWeek(week: number) {
      const t = tree();
      if (!t) return;
      check(
        await supabase.from('workouts').delete().eq('program_id', programId).eq('week_index', week),
      );
      check(
        await supabase
          .from('program_week_adjustments')
          .delete()
          .eq('program_id', programId)
          .eq('week_index', week),
      );
      // Les semaines suivantes remontent d'un cran.
      for (const w of t.workouts.filter((x) => x.week_index > week)) {
        check(
          await supabase
            .from('workouts')
            .update({ week_index: w.week_index - 1 })
            .eq('id', w.id),
        );
      }
      for (const a of t.adjustments.filter((x) => x.week_index > week)) {
        check(
          await supabase
            .from('program_week_adjustments')
            .update({ week_index: a.week_index - 1 })
            .eq('id', a.id),
        );
      }
      check(
        await supabase
          .from('programs')
          .update({ duration_weeks: Math.max(1, t.program.duration_weeks - 1) })
          .eq('id', programId),
      );
      await refresh();
    },
    async removeAdjustment(id: string) {
      check(await supabase.from('program_week_adjustments').delete().eq('id', id));
      await refresh();
    },
    async addWorkout(week: number, day: number, name: string) {
      const t = tree();
      const position = (t?.workouts.filter((w) => w.week_index === week).length ?? 0) + 1;
      const r = check(
        await supabase
          .from('workouts')
          .insert({ program_id: programId, week_index: week, day_of_week: day, name, position })
          .select('id')
          .single(),
      );
      await refresh();
      return r.data?.id;
    },
    async updateWorkout(id: string, patch: TablesUpdate<'workouts'>) {
      check(await supabase.from('workouts').update(patch).eq('id', id));
      await refresh();
    },
    async deleteWorkout(id: string) {
      check(await supabase.from('workouts').delete().eq('id', id));
      await refresh();
    },
    async duplicateWorkout(id: string) {
      check(await supabase.rpc('duplicate_workout', { p_workout: id }));
      await refresh();
    },
    async addExercises(workoutId: string, exerciseIds: string[]) {
      const t = tree();
      const existing = t?.workouts.find((w) => w.id === workoutId)?.exercises.length ?? 0;
      for (const [i, exerciseId] of exerciseIds.entries()) {
        const r = check(
          await supabase
            .from('workout_exercises')
            .insert({
              workout_id: workoutId,
              program_id: programId,
              exercise_id: exerciseId,
              position: existing + i,
            })
            .select('id')
            .single(),
        );
        // 3 séries de travail par défaut (8–12 reps, 2 min de repos, RIR 2).
        const weId = r.data?.id as string;
        check(
          await supabase.from('prescribed_sets').insert(
            [0, 1, 2].map((position) => ({
              workout_exercise_id: weId,
              program_id: programId,
              position,
              set_type: 'working' as const,
              reps_min: 8,
              reps_max: 12,
              target_rir: 2,
              rest_seconds: 120,
            })),
          ),
        );
      }
      await refresh();
    },
    async updateWorkoutExercise(id: string, patch: TablesUpdate<'workout_exercises'>) {
      check(await supabase.from('workout_exercises').update(patch).eq('id', id));
      await refresh();
    },
    async deleteWorkoutExercise(id: string) {
      check(await supabase.from('workout_exercises').delete().eq('id', id));
      await refresh();
    },
    /** Réordonne une liste (séances ou exercices) selon l'ordre donné. */
    async reorder(table: 'workouts' | 'workout_exercises', orderedIds: string[]) {
      for (const [position, id] of orderedIds.entries()) {
        check(await supabase.from(table).update({ position }).eq('id', id));
      }
      await refresh();
    },
    async addSet(weId: string) {
      const t = tree();
      const sets = t?.workouts.flatMap((w) => w.exercises).find((e) => e.id === weId)?.sets ?? [];
      const last = sets[sets.length - 1];
      check(
        await supabase.from('prescribed_sets').insert({
          workout_exercise_id: weId,
          program_id: programId,
          position: (last?.position ?? -1) + 1,
          set_type: last?.set_type ?? 'working',
          reps_min: last?.reps_min ?? 8,
          reps_max: last?.reps_max ?? 12,
          load_kg: last?.load_kg ?? null,
          load_pct_1rm: last?.load_pct_1rm ?? null,
          target_rir: last?.target_rir ?? 2,
          target_rpe: last?.target_rpe ?? null,
          rest_seconds: last?.rest_seconds ?? 120,
          tempo: last?.tempo ?? null,
          duration_seconds: last?.duration_seconds ?? null,
        }),
      );
      await refresh();
    },
    async updateSet(id: string, patch: TablesUpdate<'prescribed_sets'>) {
      check(await supabase.from('prescribed_sets').update(patch).eq('id', id));
      await refresh();
    },
    async deleteSet(id: string) {
      check(await supabase.from('prescribed_sets').delete().eq('id', id));
      await refresh();
    },
    async notifyAdherent() {
      check(await supabase.rpc('notify_program_change', { p_program: programId }));
    },
  };
}

export type ProgramActions = ReturnType<typeof useProgramActions>;
