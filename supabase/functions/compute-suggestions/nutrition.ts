// Analyse nutrition (logique indépendante de Deno : testable avec Node).
//  - Suggestion d'ajustement calorique selon l'évolution du poids (validée par le coach).
//  - Alerte « déficit + performances en baisse ».
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  addDays,
  best1RM,
  deficitPerformanceAlert,
  observedWeeklyRate,
  performanceTrend,
  suggestCalorieAdjustment,
  weekStart,
  type LoggedSet,
  type StrengthEntry,
} from '../_shared/core/index.ts';
import { log, todayParis } from '../_shared/util.ts';

/** Délai minimal entre deux ajustements caloriques (temps d'observer l'effet). */
const MIN_DAYS_BETWEEN_ADJUSTMENTS = 14;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

type TargetRow = {
  adherent_id: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  floor_kcal: number | null;
  weekly_rate_target: number | null;
};

/** Meilleur 1RM estimé par exercice et par séance, sur les 6 dernières semaines. */
async function strengthEntries(
  db: SupabaseClient,
  adherentId: string,
  today: string,
): Promise<StrengthEntry[]> {
  const since = `${addDays(today, -42)}T00:00:00Z`;
  const { data } = await db
    .from('session_logs')
    .select('started_at, sets:set_logs(exercise_id, set_type, load_kg, reps, rir, rpe, completed)')
    .eq('adherent_id', adherentId)
    .eq('status', 'completed')
    .gte('started_at', since);
  const entries: StrengthEntry[] = [];
  for (const s of data ?? []) {
    const byExercise = new Map<string, LoggedSet[]>();
    for (const r of (s.sets ?? []) as Record<string, unknown>[]) {
      const list = byExercise.get(String(r.exercise_id)) ?? [];
      list.push({
        id: '',
        setType: r.set_type as LoggedSet['setType'],
        loadKg: num(r.load_kg),
        reps: num(r.reps),
        rir: num(r.rir),
        rpe: num(r.rpe),
        completed: Boolean(r.completed),
        restSecondsActual: null,
        restSecondsPrescribed: null,
      });
      byExercise.set(String(r.exercise_id), list);
    }
    for (const [exerciseId, sets] of byExercise) {
      const best = best1RM(sets);
      if (best)
        entries.push({ date: String(s.started_at).slice(0, 10), exerciseId, best1RM: best });
    }
  }
  return entries;
}

/** Une suggestion calorique est-elle déjà en attente, ou une décision trop récente ? */
async function recentCalorieDecision(
  db: SupabaseClient,
  adherentId: string,
  today: string,
): Promise<boolean> {
  const { data } = await db
    .from('suggestions')
    .select('status, decided_at, created_at')
    .eq('adherent_id', adherentId)
    .eq('kind', 'calories')
    .order('created_at', { ascending: false })
    .limit(1);
  const last = data?.[0];
  if (!last) return false;
  if (last.status === 'pending') return true;
  const decided = String(last.decided_at ?? last.created_at).slice(0, 10);
  return decided > addDays(today, -MIN_DAYS_BETWEEN_ADJUSTMENTS);
}

/**
 * Analyse nutrition de tous les adhérents suivis (ou d'un seul).
 * Idempotent : au plus une suggestion calorique en attente et une alerte par semaine.
 */
export async function analyzeNutrition(
  db: SupabaseClient,
  adherentId: string | null = null,
): Promise<{ suggestions: number; alerts: number }> {
  const today = todayParis();
  let query = db
    .from('nutrition_targets')
    .select(
      'adherent_id, kcal, protein_g, carbs_g, fat_g, floor_kcal, weekly_rate_target, profile:profiles!inner(goal, is_active)',
    )
    .eq('calories_enabled', true)
    .not('kcal', 'is', null);
  if (adherentId) query = query.eq('adherent_id', adherentId);
  const { data: targets, error } = await query;
  if (error) throw new Error('Lecture des objectifs nutrition impossible');

  let suggestions = 0;
  let alerts = 0;
  type Profile = { goal: string | null; is_active: boolean };
  for (const row of (targets ?? []) as unknown as (TargetRow & {
    profile: Profile | Profile[] | null;
  })[]) {
    // Relation « un à un » : objet (ou tableau d'un élément selon la version du client).
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (!profile?.is_active) continue;
    const uid = row.adherent_id;
    const { data: weightRows } = await db
      .from('body_weights')
      .select('measured_on, weight_kg')
      .eq('adherent_id', uid)
      .gte('measured_on', addDays(today, -60));
    const weights = (weightRows ?? []).map((w) => ({
      date: String(w.measured_on),
      kg: Number(w.weight_kg),
    }));
    const week = weekStart(today);

    // 1. Ajustement calorique
    if (!(await recentCalorieDecision(db, uid, today))) {
      const s = suggestCalorieAdjustment({
        weights,
        today,
        goal: (profile.goal as Parameters<typeof suggestCalorieAdjustment>[0]['goal']) ?? null,
        targets: {
          kcal: Number(row.kcal),
          proteinG: Number(row.protein_g ?? 0),
          carbsG: Number(row.carbs_g ?? 0),
          fatG: Number(row.fat_g ?? 0),
          floorKcal: num(row.floor_kcal),
          weeklyRateTarget: num(row.weekly_rate_target),
        },
      });
      if (s) {
        const { error: insertError } = await db.from('suggestions').insert({
          adherent_id: uid,
          kind: 'calories',
          rule_key: 'calorie_adjustment',
          current_value: {
            kcal: s.current.kcal,
            protein_g: s.current.proteinG,
            carbs_g: s.current.carbsG,
            fat_g: s.current.fatG,
          },
          proposed_value: {
            kcal: s.proposed.kcal,
            protein_g: s.proposed.proteinG,
            carbs_g: s.proposed.carbsG,
            fat_g: s.proposed.fatG,
            actual_rate: s.actualRate,
            target_rate: s.targetRate,
          },
          justification: s.justification,
          dedupe_key: `calories:${uid}:${week}`,
        });
        if (!insertError) suggestions++;
      }
    }

    // 2. Déficit + performances en baisse
    const rate = observedWeeklyRate(weights, today);
    if (rate !== null && rate <= -0.25) {
      const perf = performanceTrend(await strengthEntries(db, uid, today), today);
      const message = deficitPerformanceAlert(rate, perf);
      if (message) {
        const { data: inserted } = await db
          .from('alerts')
          .upsert(
            {
              adherent_id: uid,
              type: 'deficit_performance',
              message,
              payload: { weekly_rate: rate, ...perf },
              dedupe_key: `deficit_perf:${uid}:${week}`,
            },
            { onConflict: 'dedupe_key', ignoreDuplicates: true },
          )
          .select('id');
        alerts += inserted?.length ?? 0;
      }
    }
  }
  log('analyse nutrition terminée', { adherents: targets?.length ?? 0, suggestions, alerts });
  return { suggestions, alerts };
}
