import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sanitizeXpRules, type XpRules } from '@/core';
import { supabase, type Tables, type TablesInsert } from '@/lib/supabase';

import { communityKeys } from './api';

export type Challenge = Tables<'challenges'> & { exercise: { name: string } | null };
export type BoardRow = {
  adherent_id: string;
  display_name: string;
  progress: number;
  completed: boolean;
  is_me: boolean;
  total: number;
};

const keys = {
  progress: (uid: string) => ['community', 'progress', uid] as const,
  rules: ['community', 'xp-rules'] as const,
  challenges: ['community', 'challenges'] as const,
  board: (id: string) => ['community', 'board', id] as const,
};

/** XP (total + derniers gains) et badges d'un adhérent (soi-même, ou le coach). */
export function useProgress(uid: string | null) {
  return useQuery({
    queryKey: keys.progress(uid ?? ''),
    enabled: uid !== null,
    queryFn: async () => {
      const [xp, badges] = await Promise.all([
        supabase
          .from('xp_events')
          .select('kind, points, occurred_on, created_at')
          .eq('adherent_id', uid as string)
          .order('created_at', { ascending: false }),
        supabase
          .from('badges_earned')
          .select('badge_key, earned_at')
          .eq('adherent_id', uid as string),
      ]);
      if (xp.error) throw xp.error;
      if (badges.error) throw badges.error;
      const events = xp.data ?? [];
      return {
        total: events.reduce((s, e) => s + e.points, 0),
        recent: events.filter((e) => e.points > 0).slice(0, 12),
        badges: new Map((badges.data ?? []).map((b) => [b.badge_key, b.earned_at])),
      };
    },
  });
}

/** Barème d'XP du coach. */
export function useXpRules() {
  return useQuery({
    queryKey: keys.rules,
    queryFn: async (): Promise<XpRules> => {
      const { data, error } = await supabase.from('app_settings').select('xp_rules').single();
      if (error) throw error;
      return sanitizeXpRules(data.xp_rules);
    },
  });
}

export function useSaveXpRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: XpRules) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ xp_rules: sanitizeXpRules(rules) })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.rules }),
  });
}

/** Challenges, avec mon inscription et le nombre de participants. */
export function useChallenges(uid: string | null) {
  return useQuery({
    queryKey: [...keys.challenges, uid ?? 'coach'],
    queryFn: async () => {
      const [list, mine, counts] = await Promise.all([
        supabase
          .from('challenges')
          .select('*, exercise:exercises(name)')
          .order('starts_on', { ascending: false }),
        uid
          ? supabase.from('challenge_participants').select('*').eq('adherent_id', uid)
          : Promise.resolve({ data: [], error: null }),
        supabase.rpc('challenge_counts'),
      ]);
      if (list.error) throw list.error;
      if (mine.error) throw mine.error;
      if (counts.error) throw counts.error;
      return {
        challenges: (list.data ?? []) as Challenge[],
        mine: new Map((mine.data ?? []).map((p) => [p.challenge_id, p])),
        counts: new Map(
          (counts.data ?? []).map((c) => [
            c.challenge_id,
            { participants: c.participants, total: Number(c.total) },
          ]),
        ),
      };
    },
  });
}

export function useChallengeBoard(id: string | null) {
  return useQuery({
    queryKey: keys.board(id ?? ''),
    enabled: id !== null,
    queryFn: async (): Promise<BoardRow[]> => {
      const { data, error } = await supabase.rpc('challenge_board', { p_challenge: id as string });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        progress: Number(r.progress),
        total: Number(r.total),
      }));
    },
  });
}

export function useChallengeActions(uid: string | null) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: communityKeys.all });
  const join = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from('challenge_participants')
        .insert({ challenge_id: challengeId, adherent_id: uid as string });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from('challenge_participants')
        .delete()
        .match({ challenge_id: challengeId, adherent_id: uid as string });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const save = useMutation({
    mutationFn: async (c: TablesInsert<'challenges'>) => {
      const { error } = c.id
        ? await supabase.from('challenges').update(c).eq('id', c.id)
        : await supabase.from('challenges').insert(c);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('challenges').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return { join, leave, save, remove };
}
