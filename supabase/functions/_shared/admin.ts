// Outils communs aux Edge Functions (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Client « administrateur » (clé service_role, jamais exposée à l'app). */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Configuration Supabase manquante');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export type Caller =
  | { kind: 'cron' }
  | { kind: 'user'; userId: string; role: 'coach' | 'adherent' };

/**
 * Identifie l'appelant :
 *  - tâche planifiée : en-tête x-cron-secret égal au secret CRON_SECRET ;
 *  - utilisateur connecté : jeton de session (coach ou adhérent actif).
 */
export async function identifyCaller(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const secret = Deno.env.get('CRON_SECRET');
  const given = req.headers.get('x-cron-secret');
  if (secret && given && given === secret) return { kind: 'cron' };

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { kind: 'user', userId: data.user.id, role: profile.role };
}

export { log, todayParis } from './util.ts';
