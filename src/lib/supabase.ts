import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { env } from './env';
import { kvStorage } from './kvStorage';

/**
 * Client Supabase unique de l'app.
 * - La session est conservée sur l'appareil (fonctionne hors-ligne).
 * - Sur le web, les retours de connexion Google/Apple sont détectés dans l'URL.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl || 'http://localhost',
  env.supabaseAnonKey || 'missing-key',
  {
    auth: {
      storage: kvStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  },
);

// Sur mobile : rafraîchir le jeton uniquement quand l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

export type { Json } from './database.types';
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
