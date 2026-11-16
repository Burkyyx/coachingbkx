import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase, type Json, type Tables } from '@/lib/supabase';

export type Overview = {
  adherent_id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  avatar_path: string | null;
  goal: Tables<'profiles'>['goal'];
  is_active: boolean;
  onboarded: boolean;
  last_session_at: string | null;
  sessions_planned_28d: number;
  sessions_done_28d: number;
  pending_suggestions: number;
  unseen_alerts: number;
  last_checkin_week: string | null;
  recent_weights: Json;
  active_program_name: string | null;
};

export function fullName(p: {
  first_name: string | null;
  last_name: string | null;
  nickname?: string | null;
}): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.nickname || 'Adhérent';
}

export const coachKeys = {
  overview: ['coach', 'overview'] as const,
  alerts: ['coach', 'alerts'] as const,
  suggestions: (status: 'pending' | 'decided') => ['coach', 'suggestions', status] as const,
  adherent: (id: string) => ['coach', 'adherent', id] as const,
};

export function useOverview() {
  return useQuery({
    queryKey: coachKeys.overview,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('coach_overview');
      if (error) throw error;
      return data as Overview[];
    },
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: coachKeys.alerts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*, adherent:profiles!alerts_adherent_id_fkey(first_name, last_name)')
        .is('seen_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkAlertsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('alerts')
        .update({ seen_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: coachKeys.alerts });
      void qc.invalidateQueries({ queryKey: coachKeys.overview });
    },
  });
}

export type SuggestionRow = Tables<'suggestions'> & {
  adherent: { first_name: string | null; last_name: string | null } | null;
  exercise: { name: string } | null;
};

export function useSuggestions(status: 'pending' | 'decided') {
  return useQuery({
    queryKey: coachKeys.suggestions(status),
    queryFn: async () => {
      let q = supabase
        .from('suggestions')
        .select(
          '*, adherent:profiles!suggestions_adherent_id_fkey(first_name, last_name), exercise:exercises(name)',
        )
        .order('created_at', { ascending: false })
        .limit(200);
      q = status === 'pending' ? q.eq('status', 'pending') : q.neq('status', 'pending');
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as SuggestionRow[];
    },
  });
}

/** Décisions du coach sur les suggestions. */
export function useSuggestionActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['coach'] });
  };
  return {
    async accept(id: string, finalValue?: Record<string, unknown>) {
      const { error } = await supabase.rpc('apply_suggestion', {
        p_id: id,
        p_final: (finalValue ?? null) as Json,
      });
      if (error) throw error;
      refresh();
    },
    async reject(ids: string[]) {
      const { error } = await supabase
        .from('suggestions')
        .update({ status: 'rejected', decided_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pending');
      if (error) throw error;
      refresh();
    },
    async revert(id: string) {
      const { error } = await supabase.rpc('revert_suggestion', { p_id: id });
      if (error) throw error;
      refresh();
    },
  };
}

/** Lance l'analyse des séances (Edge Function) — utile juste après une synchro. */
export async function runAnalysis(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('compute-suggestions', { body: {} });
  if (error) throw error;
  return (data as { suggestions?: number } | null)?.suggestions ?? 0;
}
