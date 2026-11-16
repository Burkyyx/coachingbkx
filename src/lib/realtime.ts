import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from './supabase';

let counter = 0;

/**
 * Crée un canal temps réel au nom UNIQUE.
 * Supabase réutilise un canal existant s'il porte le même nom : quand un écran est
 * masqué puis réaffiché (ou monté deux fois), on récupérerait un canal déjà abonné
 * et l'ajout d'un écouteur planterait. Un suffixe unique évite ce problème.
 */
export function uniqueChannel(prefix: string): RealtimeChannel {
  counter += 1;
  return supabase.channel(`${prefix}:${Date.now().toString(36)}-${counter}`);
}

/** Fermeture propre d'un canal (à appeler dans le nettoyage de l'effet). */
export function closeChannel(channel: RealtimeChannel) {
  void supabase.removeChannel(channel);
}
