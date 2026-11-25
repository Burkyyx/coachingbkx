// -----------------------------------------------------------------------------
// Edge Function « analyze-meal » : estimation des aliments d'une photo de repas
// par Claude (modèle réglable : variable ANTHROPIC_MODEL, Claude Haiku 5.5 par défaut).
//
// Secrets (côté Supabase uniquement, jamais dans l'app) :
//   ANTHROPIC_API_KEY  — clé de l'API Anthropic (sans elle : « analyse indisponible »)
//   ANTHROPIC_MODEL    — facultatif
// -----------------------------------------------------------------------------
import { adminClient, corsHeaders, identifyCaller, json } from '../_shared/admin.ts';

import { analyzeMeal } from './analyze.ts';
import { modelCaller } from './model.ts';

const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-5-5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = adminClient();
  const caller = await identifyCaller(req, db);
  if (caller?.kind !== 'user') return json({ error: 'Non autorisé' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ code: 'ai_not_configured' }, 503);

  const input = (await req.json().catch(() => ({}))) as { path?: unknown; hint?: unknown };
  const reply = await analyzeMeal(db, caller, input, MODEL, modelCaller(apiKey, MODEL));
  return json(reply.body, reply.status);
});
