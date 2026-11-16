import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase, type Tables } from '@/lib/supabase';
import { extensionFor, uploadFile } from '@/lib/storage';
import { uuid } from '@/lib/uuid';

export type Message = Tables<'messages'>;

const keys = {
  conversation: (adherentId: string) => ['conversation', adherentId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  list: ['coach', 'conversations'] as const,
};

/** Conversation d'un adhérent (une seule, avec le coach). */
export function useConversation(adherentId: string | null) {
  return useQuery({
    queryKey: keys.conversation(adherentId ?? ''),
    enabled: !!adherentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, adherent_id')
        .eq('adherent_id', adherentId as string)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Messages d'une conversation, mis à jour en temps réel (Supabase Realtime). */
export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void qc.invalidateQueries({ queryKey: keys.messages(conversationId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  return useQuery({
    queryKey: keys.messages(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId as string)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export type Outgoing = {
  conversationId: string;
  adherentId: string;
  senderId: string;
  text?: string;
  media?: { uri: string; mime: string; durationSeconds: number | null; kind: 'image' | 'video' };
};

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Outgoing) => {
      const id = uuid();
      let mediaPath: string | null = null;
      if (m.media) {
        mediaPath = `${m.adherentId}/${id}.${extensionFor(m.media.mime)}`;
        await uploadFile('message-media', mediaPath, m.media.uri, m.media.mime);
      }
      const { error } = await supabase.from('messages').insert({
        id,
        conversation_id: m.conversationId,
        sender_id: m.senderId,
        kind: m.media ? m.media.kind : 'text',
        body: m.text?.trim() || null,
        media_path: mediaPath,
        media_duration_seconds: m.media?.durationSeconds ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, m) => {
      void qc.invalidateQueries({ queryKey: keys.messages(m.conversationId) });
      void qc.invalidateQueries({ queryKey: keys.list });
    },
  });
}

/** Marque comme lus les messages reçus d'une conversation. */
export async function markConversationRead(conversationId: string, myId: string) {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', myId)
    .is('read_at', null);
}

/** Liste des conversations du coach (dernier message, non lus). */
export function useCoachConversations(coachId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('coach-conversations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        void qc.invalidateQueries({ queryKey: keys.list });
        void qc.invalidateQueries({ queryKey: ['coach', 'badges'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
  return useQuery({
    queryKey: keys.list,
    enabled: !!coachId,
    queryFn: async () => {
      const [conv, unread] = await Promise.all([
        supabase
          .from('conversations')
          .select(
            'id, adherent_id, last_message_at, adherent:profiles!conversations_adherent_id_fkey(first_name, last_name, is_active)',
          )
          .order('last_message_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('messages')
          .select('conversation_id')
          .is('read_at', null)
          .neq('sender_id', coachId as string),
      ]);
      if (conv.error) throw conv.error;
      if (unread.error) throw unread.error;
      const counts = new Map<string, number>();
      for (const m of unread.data)
        counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
      return conv.data.map((c) => ({ ...c, unread: counts.get(c.id) ?? 0 }));
    },
  });
}
