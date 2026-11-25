// -----------------------------------------------------------------------------
// Edge Function « compute-suggestions »
// Analyse les séances terminées pas encore analysées et crée les suggestions
// et alertes pour le coach (algorithmes du module core, identiques à l'app).
//
// Appelée : par la tâche planifiée (toutes les 10 min) ET par l'app juste après
// la synchronisation d'une séance (analyse immédiate).
// -----------------------------------------------------------------------------
import {
  adminClient,
  corsHeaders,
  errorDetail,
  identifyCaller,
  json,
  log,
} from '../_shared/admin.ts';

import { analyzePending } from './analyze.ts';
import { analyzeNutrition } from './nutrition.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = adminClient();
  const caller = await identifyCaller(req, db);
  if (!caller) return json({ error: 'Non autorisé' }, 401);
  try {
    // Un adhérent ne peut déclencher que l'analyse de ses propres séances.
    const adherentId = caller.kind === 'user' && caller.role === 'adherent' ? caller.userId : null;
    const training = await analyzePending(db, adherentId);
    // Nutrition : un échec n'empêche pas l'analyse des séances.
    const nutrition = await analyzeNutrition(db, adherentId).catch((e) => {
      log('analyse nutrition en échec', errorDetail(e));
      return { suggestions: 0, alerts: 0 };
    });
    return json({ ...training, nutrition });
  } catch (e) {
    const d = errorDetail(e);
    log('analyse en échec', d);
    return json({ error: 'Analyse impossible', ...d }, 500);
  }
});
