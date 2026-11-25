// Analyse d'une photo de repas (logique indépendante de Deno : testable avec Node).
// L'appel au modèle est injecté (index.ts : SDK Anthropic ; tests : modèle simulé).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { aiCostUsd, localDateOf, parseMealAnalysis } from '../_shared/core/index.ts';
import { log, todayParis } from '../_shared/util.ts';

export type ModelResult = {
  /** Texte de la réponse (JSON imposé par le schéma), null si aucun. */
  text: string | null;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
};

/** Erreur d'appel au modèle, classée pour l'app. */
export class ModelError extends Error {
  readonly code: 'ai_auth' | 'ai_busy' | 'ai_error';
  constructor(code: 'ai_auth' | 'ai_busy' | 'ai_error', message: string) {
    super(message);
    this.code = code;
  }
}

export type CallModel = (
  image: { base64: string; mediaType: string },
  hint: string | null,
) => Promise<ModelResult>;

export type Reply = { status: number; body: Record<string, unknown> };

const DEFAULT_DAILY_LIMIT = 10;
const MAX_BYTES = 5 * 1024 * 1024;

/** Base64 sans dépendance (Deno comme Node). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mediaTypeOf(path: string): string {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** Analyses restantes aujourd'hui (heure de Paris), avec la limite fixée par le coach. */
export async function analysesLeft(db: SupabaseClient, userId: string): Promise<number> {
  const { data: target } = await db
    .from('nutrition_targets')
    .select('ai_daily_limit')
    .eq('adherent_id', userId)
    .maybeSingle();
  const limit = target?.ai_daily_limit ?? DEFAULT_DAILY_LIMIT;
  const since = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
  const { data: usage } = await db
    .from('ai_usage')
    .select('created_at, status')
    .eq('adherent_id', userId)
    .gte('created_at', since)
    .in('status', ['ok', 'invalid']);
  const today = todayParis();
  const used = (usage ?? []).filter((u) => localDateOf(u.created_at) === today).length;
  return Math.max(0, limit - used);
}

/**
 * Vérifie les droits (adhérent, consentement « analyse photo », suivi des calories actif,
 * limite du jour), envoie la photo au modèle et renvoie les aliments estimés.
 * Seule la photo (sans nom ni identifiant) et la précision facultative sont envoyées.
 */
export async function analyzeMeal(
  db: SupabaseClient,
  caller: { userId: string; role: 'coach' | 'adherent' },
  input: { path?: unknown; hint?: unknown },
  model: string,
  callModel: CallModel,
): Promise<Reply> {
  const userId = caller.userId;
  if (caller.role !== 'adherent') return { status: 403, body: { code: 'forbidden' } };

  const path = typeof input.path === 'string' ? input.path : '';
  const pattern = new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$`);
  if (!pattern.test(path)) return { status: 400, body: { code: 'bad_path' } };
  const hint = typeof input.hint === 'string' ? input.hint.slice(0, 200) : null;

  const { data: consent } = await db
    .from('consents')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'ai_photo')
    .is('revoked_at', null)
    .limit(1);
  if (!consent?.length) return { status: 403, body: { code: 'consent_required' } };

  const { data: target } = await db
    .from('nutrition_targets')
    .select('calories_enabled')
    .eq('adherent_id', userId)
    .maybeSingle();
  if (target && target.calories_enabled === false)
    return { status: 403, body: { code: 'calories_disabled' } };

  const left = await analysesLeft(db, userId);
  if (left <= 0) return { status: 429, body: { code: 'limit_reached', analysesLeft: 0 } };

  const { data: file, error: fileError } = await db.storage.from('meal-photos').download(path);
  if (fileError || !file) return { status: 404, body: { code: 'photo_not_found' } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES)
    return { status: 400, body: { code: 'photo_too_large' } };

  const record = async (status: 'ok' | 'invalid' | 'error', r?: ModelResult) => {
    const { error } = await db.from('ai_usage').insert({
      adherent_id: userId,
      model,
      status,
      input_tokens: r?.inputTokens ?? 0,
      output_tokens: r?.outputTokens ?? 0,
      cost_usd: r ? aiCostUsd(model, r.inputTokens, r.outputTokens) : 0,
    });
    if (error) log('suivi IA non enregistré', { code: error.code ?? '' });
  };

  let result: ModelResult;
  try {
    result = await callModel({ base64: toBase64(bytes), mediaType: mediaTypeOf(path) }, hint);
  } catch (e) {
    const code = e instanceof ModelError ? e.code : 'ai_error';
    log('analyse photo en échec', {
      code,
      detail: String((e as Error)?.message ?? e).slice(0, 200),
    });
    await record('error'); // une erreur technique ne compte pas dans la limite
    return { status: code === 'ai_busy' ? 503 : 502, body: { code, analysesLeft: left } };
  }

  const analysis = result.stopReason === 'refusal' ? null : parseMealAnalysis(result.text);
  if (!analysis) {
    await record('invalid', result);
    log('analyse photo inexploitable', { stop: result.stopReason ?? '' });
    return { status: 422, body: { code: 'ai_invalid', analysesLeft: left - 1 } };
  }
  await record('ok', result);
  log('analyse photo', {
    items: analysis.items.length,
    tokens: result.inputTokens + result.outputTokens,
  });
  return { status: 200, body: { ...analysis, analysesLeft: left - 1 } };
}
