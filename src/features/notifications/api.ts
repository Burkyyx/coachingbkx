import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { closeChannel, uniqueChannel } from '@/lib/realtime';
import { supabase, type Tables } from '@/lib/supabase';

export type AppNotification = Tables<'notifications'>;

/** Types de notifications réglables, selon le rôle. */
export const ADHERENT_TYPES = [
  'session_reminder',
  'rest_timer',
  'program_updated',
  'coach_message',
  'checkin_reminder',
  'checkin_reply',
  'nutrition_updated',
  'meal_comment',
] as const;
export const COACH_TYPES = ['new_checkin', 'new_message', 'new_record', 'inactivity'] as const;

const key = (uid: string | null) => ['notifications', uid] as const;

/** Centre de notifications (mis à jour en temps réel). */
export function useNotifications(uid: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!uid) return;
    const channel = uniqueChannel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => void qc.invalidateQueries({ queryKey: key(uid) }),
      )
      .subscribe();
    return () => {
      closeChannel(channel);
    };
  }, [uid, qc]);
  return useQuery({
    queryKey: key(uid),
    enabled: uid !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkAllRead(uid: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: key(uid) }),
  });
}

/** Écran à ouvrir quand on touche une notification. */
export function targetOf(n: Pick<AppNotification, 'type' | 'data'>): Href | null {
  const data = (n.data ?? {}) as Record<string, string | undefined>;
  switch (n.type) {
    case 'coach_message':
      return '/messages';
    case 'program_updated':
      return '/program';
    case 'nutrition_updated':
    case 'meal_comment':
      return '/nutrition';
    case 'checkin_reply':
    case 'checkin_reminder':
      return '/checkin';
    case 'session_reminder':
      return '/today';
    case 'new_message':
      return data.adherent_id ? `/coach/messages/${data.adherent_id}` : '/coach/messages';
    case 'new_checkin':
    case 'new_record':
      return data.adherent_id ? `/coach/adherents/${data.adherent_id}` : '/coach';
    case 'inactivity':
      return '/coach';
    default:
      return null;
  }
}

export function openNotification(n: Pick<AppNotification, 'type' | 'data'>) {
  const target = targetOf(n);
  if (target) router.push(target);
}

/** Préférence d'un type (absente = activée). */
export function isEnabled(prefs: unknown, type: string): boolean {
  const p = (prefs ?? {}) as Record<string, unknown>;
  return p[type] !== false;
}
