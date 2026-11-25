import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addDays, todayLocal } from '@/core';
import { supabase, type Tables, type TablesUpdate } from '@/lib/supabase';

/** Données de la fiche adhérent (espace coach). */

const k = (id: string, part: string) => ['coach', 'adherent', id, part] as const;

export function useAdherentProfile(id: string) {
  return useQuery({
    queryKey: k(id, 'profile'),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

export type SessionWithSets = Tables<'session_logs'> & {
  workout: { name: string } | null;
  sets: Tables<'set_logs'>[];
};

export function useAdherentSessions(id: string, days = 120) {
  return useQuery({
    queryKey: k(id, `sessions-${days}`),
    queryFn: async () => {
      const since = addDays(todayLocal(), -days);
      const [s, sets] = await Promise.all([
        supabase
          .from('session_logs')
          .select('*, workout:workouts(name)')
          .eq('adherent_id', id)
          .gte('started_at', since)
          .order('started_at', { ascending: false }),
        supabase
          .from('set_logs')
          .select('*')
          .eq('adherent_id', id)
          .gte('performed_at', since)
          .order('position'),
      ]);
      if (s.error) throw s.error;
      if (sets.error) throw sets.error;
      const bySession = new Map<string, Tables<'set_logs'>[]>();
      for (const set of sets.data) {
        bySession.set(set.session_log_id, [...(bySession.get(set.session_log_id) ?? []), set]);
      }
      return (s.data as unknown as SessionWithSets[]).map((x) => ({
        ...x,
        sets: bySession.get(x.id) ?? [],
      }));
    },
  });
}

export function useAdherentRecords(id: string) {
  return useQuery({
    queryKey: k(id, 'records'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*, exercise:exercises(name)')
        .eq('adherent_id', id)
        .order('achieved_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useAdherentCheckins(id: string) {
  return useQuery({
    queryKey: k(id, 'checkins'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('adherent_id', id)
        .order('week_start', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
}

export function useAdherentWeights(id: string) {
  return useQuery({
    queryKey: k(id, 'weights'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_weights')
        .select('measured_on, weight_kg')
        .eq('adherent_id', id)
        .gte('measured_on', addDays(todayLocal(), -120))
        .order('measured_on');
      if (error) throw error;
      return data;
    },
  });
}

export function useCoachNotes(id: string) {
  return useQuery({
    queryKey: k(id, 'notes'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_notes')
        .select('*')
        .eq('adherent_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useReference1rm(id: string) {
  return useQuery({
    queryKey: k(id, '1rm'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_1rm')
        .select('*, exercise:exercises(name)')
        .eq('adherent_id', id);
      if (error) throw error;
      return data;
    },
  });
}

export function useActiveProgram(id: string) {
  return useQuery({
    queryKey: k(id, 'program'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name, start_date, duration_weeks, status')
        .eq('adherent_id', id)
        .in('status', ['active', 'draft'])
        .order('start_date', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
}

/** Actions de la fiche adhérent. */
export function useAdherentActions(id: string) {
  const qc = useQueryClient();
  const refresh = (part?: string) =>
    qc.invalidateQueries({ queryKey: part ? k(id, part) : ['coach', 'adherent', id] });
  return {
    updateProfile: useMutation({
      mutationFn: async (patch: TablesUpdate<'profiles'>) => {
        const { error } = await supabase.from('profiles').update(patch).eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => {
        void refresh('profile');
        void qc.invalidateQueries({ queryKey: ['coach', 'overview'] });
      },
    }),
    addNote: useMutation({
      mutationFn: async (body: string) => {
        const { error } = await supabase.from('coach_notes').insert({ adherent_id: id, body });
        if (error) throw error;
      },
      onSuccess: () => void refresh('notes'),
    }),
    deleteNote: useMutation({
      mutationFn: async (noteId: string) => {
        const { error } = await supabase.from('coach_notes').delete().eq('id', noteId);
        if (error) throw error;
      },
      onSuccess: () => void refresh('notes'),
    }),
    replyCheckin: useMutation({
      mutationFn: async ({ checkinId, reply }: { checkinId: string; reply: string }) => {
        const { error } = await supabase
          .from('checkins')
          .update({ coach_reply: reply })
          .eq('id', checkinId);
        if (error) throw error;
      },
      onSuccess: () => void refresh('checkins'),
    }),
    set1rm: useMutation({
      mutationFn: async ({ exerciseId, value }: { exerciseId: string; value: number | null }) => {
        if (value === null) {
          const { error } = await supabase
            .from('reference_1rm')
            .delete()
            .eq('adherent_id', id)
            .eq('exercise_id', exerciseId);
          if (error) throw error;
          return;
        }
        const { error } = await supabase.from('reference_1rm').upsert({
          adherent_id: id,
          exercise_id: exerciseId,
          value_kg: value,
          measured_on: todayLocal(),
        });
        if (error) throw error;
      },
      onSuccess: () => void refresh('1rm'),
    }),
  };
}

/** Suppression d'une séance de l'adhérent (même en cours) : séries et records compris. */
export function useDeleteSession(adherentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('delete_session_log', { p_id: sessionId });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['coach', 'adherent', adherentId] });
      void qc.invalidateQueries({ queryKey: ['coach'] });
    },
  });
}

/** Suppression DÉFINITIVE d'un adhérent (compte, données et fichiers). */
export function useDeleteAdherent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (adherentId: string) => {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { adherent_id: adherentId },
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coach'] }),
  });
}
