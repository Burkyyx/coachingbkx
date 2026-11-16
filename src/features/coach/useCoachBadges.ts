import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/** Compteurs affichés dans la navigation du coach (suggestions en attente, messages non lus). */
export function useCoachBadges() {
  const { userId } = useAuth();
  const { data } = useQuery({
    queryKey: ['coach', 'badges'],
    enabled: userId !== null,
    queryFn: async () => {
      const [s, m] = await Promise.all([
        supabase
          .from('suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .is('read_at', null)
          .neq('sender_id', userId as string),
      ]);
      return { pendingSuggestions: s.count ?? 0, unreadMessages: m.count ?? 0 };
    },
    refetchInterval: 60_000,
  });
  return data ?? { pendingSuggestions: 0, unreadMessages: 0 };
}
