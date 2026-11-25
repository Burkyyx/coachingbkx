import { useQuery } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';

import type { MealAnalysis } from '@/core';
import { supabase } from '@/lib/supabase';

/** Chemin de la photo d'un repas dans le bucket privé « meal-photos ». */
export const mealPhotoPath = (adherentId: string, mealId: string) => `${adherentId}/${mealId}.jpg`;

export type AnalysisErrorCode =
  | 'ai_not_configured'
  | 'limit_reached'
  | 'ai_busy'
  | 'consent_required'
  | 'calories_disabled'
  | 'ai_failed';

export type AnalysisResult =
  | { ok: true; analysis: MealAnalysis; analysesLeft: number | null }
  | { ok: false; code: AnalysisErrorCode; analysesLeft: number | null };

/** Analyse par l'IA d'une photo déjà envoyée (Edge Function « analyze-meal »). */
export async function analyzeMealPhoto(path: string, hint: string): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke<MealAnalysis & { analysesLeft?: number }>(
    'analyze-meal',
    { body: { path, hint: hint.trim() || null } },
  );
  if (!error && data) {
    return { ok: true, analysis: data, analysesLeft: data.analysesLeft ?? null };
  }
  let body: { code?: string; analysesLeft?: number } = {};
  if (error instanceof FunctionsHttpError) {
    body = await (error.context as Response).json().catch(() => ({}));
  }
  const known: AnalysisErrorCode[] = [
    'ai_not_configured',
    'limit_reached',
    'ai_busy',
    'consent_required',
    'calories_disabled',
  ];
  const code = known.find((k) => k === body.code) ?? 'ai_failed';
  return { ok: false, code, analysesLeft: body.analysesLeft ?? null };
}

/** Analyses photo restantes aujourd'hui (limite fixée par le coach). */
export function useAnalysesLeft(enabled: boolean) {
  return useQuery({
    queryKey: ['nutrition', 'ai-left'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ai_analyses_left');
      if (error) throw error;
      return data;
    },
  });
}
