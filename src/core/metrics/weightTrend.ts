import { daysBetween } from './schedule.ts';

export type WeightPoint = { date: string; kg: number };
export type TrendPoint = WeightPoint & { trend: number };

/**
 * Tendance de poids par moyenne mobile exponentielle (lisse les variations
 * quotidiennes : eau, sel, digestion…).
 *
 * `alpha` = part donnée à une nouvelle pesée faite 1 jour après la précédente
 * (0,1 = 10 %). Si plusieurs jours séparent deux pesées, le lissage s'adapte :
 * alpha effectif = 1 − (1 − alpha)^jours.
 */
export function weightTrend(points: readonly WeightPoint[], alpha = 0.1): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const result: TrendPoint[] = [];
  let trend: number | null = null;
  let lastDate: string | null = null;
  for (const p of sorted) {
    if (trend === null || lastDate === null) {
      trend = p.kg;
    } else {
      const gap = Math.max(1, daysBetween(lastDate, p.date));
      const a = 1 - (1 - alpha) ** gap;
      trend = trend + a * (p.kg - trend);
    }
    lastDate = p.date;
    result.push({ ...p, trend: Math.round(trend * 100) / 100 });
  }
  return result;
}

/**
 * Vitesse d'évolution de la tendance, en % du poids par semaine,
 * calculée sur les `windowDays` derniers jours (régression linéaire).
 * Renvoie null s'il n'y a pas assez de données.
 */
export function weeklyTrendRate(trend: readonly TrendPoint[], windowDays = 14): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1];
  if (!last) return null;
  const recent = trend.filter((p) => daysBetween(p.date, last.date) <= windowDays);
  if (recent.length < 2) return null;
  const first = recent[0];
  if (!first || daysBetween(first.date, last.date) < 4) return null;

  const xs = recent.map((p) => daysBetween(first.date, p.date));
  const ys = recent.map((p) => p.trend);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += ((xs[i] ?? 0) - mx) * ((ys[i] ?? 0) - my);
    den += ((xs[i] ?? 0) - mx) ** 2;
  }
  if (den === 0) return null;
  const slopePerDay = num / den;
  return Math.round(((slopePerDay * 7) / last.trend) * 100 * 100) / 100;
}

/** Variation de la tendance (kg) entre le premier et le dernier point. */
export function trendDelta(trend: readonly TrendPoint[]): number | null {
  const first = trend[0];
  const last = trend[trend.length - 1];
  if (!first || !last || trend.length < 2) return null;
  return Math.round((last.trend - first.trend) * 10) / 10;
}
