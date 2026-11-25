// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Journal alimentaire : totaux, moyenne de la semaine, conversion « pour 100 g ».
 * TypeScript pur, testé.
 */

export type Macros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export const ZERO_MACROS: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** Somme de plusieurs aliments ou repas. */
export function sumMacros(list: readonly Partial<Macros>[]): Macros {
  return list.reduce<Macros>(
    (acc, x) => ({
      kcal: acc.kcal + (x.kcal ?? 0),
      proteinG: acc.proteinG + (x.proteinG ?? 0),
      carbsG: acc.carbsG + (x.carbsG ?? 0),
      fatG: acc.fatG + (x.fatG ?? 0),
    }),
    { ...ZERO_MACROS },
  );
}

/** Valeurs pour une quantité donnée, à partir des valeurs pour 100 g (étiquette, Open Food Facts). */
export function macrosForGrams(per100g: Partial<Macros>, grams: number): Macros {
  const f = Math.max(0, grams) / 100;
  const r = (n: number | undefined) => Math.round((n ?? 0) * f * 10) / 10;
  return {
    kcal: r(per100g.kcal),
    proteinG: r(per100g.proteinG),
    carbsG: r(per100g.carbsG),
    fatG: r(per100g.fatG),
  };
}

/** Date locale (AAAA-MM-JJ) d'un horodatage, dans le fuseau donné (Paris par défaut). */
export function localDateOf(isoTimestamp: string, timeZone = 'Europe/Paris'): string {
  return new Date(isoTimestamp).toLocaleDateString('sv-SE', { timeZone });
}

/**
 * Moyenne quotidienne sur les jours où quelque chose a été saisi (un jour vide n'est pas
 * compté comme « 0 kcal » : on ne pénalise pas un oubli de saisie).
 */
export function dailyAverage(days: readonly { date: string; totals: Macros; count: number }[]): {
  average: Macros;
  loggedDays: number;
} {
  const logged = days.filter((d) => d.count > 0);
  if (logged.length === 0) return { average: { ...ZERO_MACROS }, loggedDays: 0 };
  const total = sumMacros(logged.map((d) => d.totals));
  const n = logged.length;
  return {
    average: {
      kcal: Math.round(total.kcal / n),
      proteinG: Math.round(total.proteinG / n),
      carbsG: Math.round(total.carbsG / n),
      fatG: Math.round(total.fatG / n),
    },
    loggedDays: n,
  };
}

/** Part de l'objectif atteinte (0 → 1+), null sans objectif. */
export function progressOf(value: number, target: number | null | undefined): number | null {
  if (!target || target <= 0) return null;
  return Math.max(0, value / target);
}

/** Type de repas proposé selon l'heure (modifiable par l'adhérent). */
export function mealTypeForHour(hour: number): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'snack';
}
