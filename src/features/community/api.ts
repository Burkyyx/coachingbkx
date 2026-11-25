import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CONSENT_VERSION } from '@/features/auth/consents';
import { uploadFile } from '@/lib/storage';
import { supabase, type Tables } from '@/lib/supabase';
import { uuid } from '@/lib/uuid';

export type Post = Tables<'posts'> & {
  reactions: { emoji: string; author_id: string }[];
  comments: { count: number }[];
};
export type Comment = Tables<'post_comments'>;
export type Person = {
  id: string;
  display_name: string;
  is_coach: boolean;
  xp: number;
  badges: number;
  is_me: boolean;
};

export const REACTIONS = ['💪', '🔥', '👏', '❤️'] as const;
export type Reaction = (typeof REACTIONS)[number];

const PAGE = 20;

export const communityKeys = {
  all: ['community'] as const,
  people: ['community', 'people'] as const,
  member: (uid: string) => ['community', 'member', uid] as const,
  feed: ['community', 'feed'] as const,
  comments: (postId: string) => ['community', 'comments', postId] as const,
};

/** Nom affiché dans la communauté : le pseudo, sinon « Prénom N. ». */
export function defaultDisplayName(p: {
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const nick = p.nickname?.trim();
  if (nick) return nick.slice(0, 30);
  const first = p.first_name?.trim() ?? '';
  const initial = p.last_name?.trim()?.[0];
  return `${first}${initial ? ` ${initial.toUpperCase()}.` : ''}`.trim().slice(0, 30) || 'Membre';
}

/** Membres visibles (pseudo, XP, badges) — jamais de donnée de poids ni de nutrition. */
export function useCommunityPeople(enabled = true) {
  return useQuery({
    queryKey: communityKeys.people,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('community_people');
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.id, p as Person]));
    },
  });
}

/** Adhésion de l'utilisateur à la communauté (null si non membre). */
export function useMembership(uid: string | null) {
  return useQuery({
    queryKey: communityKeys.member(uid ?? ''),
    enabled: uid !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_members')
        .select('*')
        .eq('adherent_id', uid as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Rejoindre la communauté : consentement « communauté » (s'il manque) puis adhésion.
 * Marque aussi la fenêtre de proposition comme vue.
 */
export async function joinCommunity(
  uid: string,
  opts: { displayName: string; autoPosts: boolean; hasConsent: boolean },
) {
  if (!opts.hasConsent) {
    const { error } = await supabase
      .from('consents')
      .insert({ user_id: uid, type: 'community', version: CONSENT_VERSION });
    if (error) throw error;
  }
  const { error } = await supabase.from('community_members').upsert({
    adherent_id: uid,
    display_name: opts.displayName.trim().slice(0, 30) || 'Membre',
    auto_posts: opts.autoPosts,
  });
  if (error) throw error;
  await markCommunityPrompted(uid);
}

/** La proposition de rejoindre la communauté a été vue (ne plus la réafficher). */
export async function markCommunityPrompted(uid: string) {
  await supabase
    .from('profiles')
    .update({ community_prompted_at: new Date().toISOString() })
    .eq('id', uid);
}

export function useMembershipActions(uid: string) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: communityKeys.all });
  const update = useMutation({
    mutationFn: async (patch: { display_name?: string; auto_posts?: boolean }) => {
      const { error } = await supabase
        .from('community_members')
        .update(patch)
        .eq('adherent_id', uid);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('community_members').delete().eq('adherent_id', uid);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return { update, leave };
}

/** Fil (du plus récent au plus ancien), par pages. */
export function useFeed(enabled = true) {
  return useInfiniteQuery({
    queryKey: communityKeys.feed,
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Post[]> => {
      let q = supabase
        .from('posts')
        .select('*, reactions:post_reactions(emoji, author_id), comments:post_comments(count)')
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Post[];
    },
    getNextPageParam: (last) => (last.length < PAGE ? null : (last.at(-1)?.created_at ?? null)),
  });
}

export function usePostActions(uid: string) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: communityKeys.all });

  const create = useMutation({
    mutationFn: async (p: { body: string; photoUri: string | null }) => {
      const id = uuid();
      let photoPath: string | null = null;
      if (p.photoUri) {
        photoPath = `${uid}/${id}.jpg`;
        await uploadFile('community-media', photoPath, p.photoUri, 'image/jpeg');
      }
      const { error } = await supabase
        .from('posts')
        .insert({ id, author_id: uid, body: p.body.trim() || null, photo_path: photoPath });
      if (error) {
        if (photoPath) await supabase.storage.from('community-media').remove([photoPath]);
        throw error;
      }
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (post: Pick<Post, 'id' | 'photo_path'>) => {
      if (post.photo_path) await supabase.storage.from('community-media').remove([post.photo_path]);
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const react = useMutation({
    mutationFn: async ({ post, emoji, on }: { post: string; emoji: Reaction; on: boolean }) => {
      const { error } = on
        ? await supabase.from('post_reactions').insert({ post_id: post, author_id: uid, emoji })
        : await supabase
            .from('post_reactions')
            .delete()
            .match({ post_id: post, author_id: uid, emoji });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: communityKeys.feed }),
  });

  const report = useMutation({
    mutationFn: async (target: { postId?: string; commentId?: string; reason?: string }) => {
      const { error } = await supabase.from('community_reports').insert({
        reporter_id: uid,
        post_id: target.postId ?? null,
        comment_id: target.commentId ?? null,
        reason: target.reason?.trim() || null,
      });
      if (error) throw error;
    },
  });

  return { create, remove, react, report };
}

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: communityKeys.comments(postId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useCommentActions(uid: string, postId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: communityKeys.comments(postId) });
    void qc.invalidateQueries({ queryKey: communityKeys.feed });
  };
  const add = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, author_id: uid, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('post_comments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return { add, remove };
}

/** Message refusé par le filtre de mots interdits. */
export function isBannedWordError(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === '22023';
}
