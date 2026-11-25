import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

import { communityKeys } from './api';

export type ReportRow = {
  id: string;
  reporter_id: string;
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
  post: {
    id: string;
    author_id: string;
    body: string | null;
    kind: string;
    hidden_at: string | null;
    photo_path: string | null;
  } | null;
  comment: { id: string; author_id: string; body: string; hidden_at: string | null } | null;
};

const keys = {
  reports: ['community', 'reports'] as const,
  words: ['community', 'banned-words'] as const,
  members: ['community', 'members'] as const,
};

/** Signalements non traités (espace coach). */
export function useReports() {
  return useQuery({
    queryKey: keys.reports,
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await supabase
        .from('community_reports')
        .select(
          'id, reporter_id, reason, created_at, resolved_at, post:posts(id, author_id, body, kind, hidden_at, photo_path), comment:post_comments(id, author_id, body, hidden_at)',
        )
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReportRow[];
    },
  });
}

/** Membres (y compris suspendus) : espace coach. */
export function useMembers() {
  return useQuery({
    queryKey: keys.members,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_members')
        .select('*')
        .order('display_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useBannedWords() {
  return useQuery({
    queryKey: keys.words,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_banned_words')
        .select('word')
        .order('word');
      if (error) throw error;
      return (data ?? []).map((w) => w.word);
    },
  });
}

export function useModeration() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: communityKeys.all });

  const hidePost = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase
        .from('posts')
        .update({ hidden_at: hidden ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const hideComment = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) => {
      const { error } = await supabase
        .from('post_comments')
        .update({ hidden_at: hidden ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const deletePost = useMutation({
    mutationFn: async (post: { id: string; photo_path: string | null }) => {
      if (post.photo_path) await supabase.storage.from('community-media').remove([post.photo_path]);
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('post_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const resolveReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_reports')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const suspend = useMutation({
    mutationFn: async ({ adherentId, suspended }: { adherentId: string; suspended: boolean }) => {
      const { error } = await supabase
        .from('community_members')
        .update({ suspended_at: suspended ? new Date().toISOString() : null })
        .eq('adherent_id', adherentId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const addWord = useMutation({
    mutationFn: async (word: string) => {
      const { error } = await supabase
        .from('community_banned_words')
        .insert({ word: word.trim().toLowerCase() });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const removeWord = useMutation({
    mutationFn: async (word: string) => {
      const { error } = await supabase.from('community_banned_words').delete().eq('word', word);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return {
    hidePost,
    hideComment,
    deletePost,
    deleteComment,
    resolveReport,
    suspend,
    addWord,
    removeWord,
  };
}
