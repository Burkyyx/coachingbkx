// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Calendrier des programmes. Même logique que la fonction SQL public.workout_date :
 * semaine 1 = semaine (lundi → dimanche) contenant la date de début ;
 * jour 1 = lundi … 7 = dimanche.
 *
 * Les dates sont manipulées au format « AAAA-MM-JJ » (sans fuseau horaire).
 */

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Jour ISO (1 = lundi … 7 = dimanche). */
export function isoWeekday(date: string): number {
  const day = new Date(toUtc(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Lundi de la semaine contenant `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** Nombre de jours entre deux dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Date prévue d'une séance. */
export function workoutDate(programStart: string, weekIndex: number, dayOfWeek: number): string {
  return addDays(weekStart(programStart), (weekIndex - 1) * 7 + (dayOfWeek - 1));
}

/** Numéro de semaine du programme pour une date (peut être < 1 ou > durée). */
export function programWeekIndex(programStart: string, date: string): number {
  return Math.floor(daysBetween(weekStart(programStart), date) / 7) + 1;
}

/** Date du jour au format AAAA-MM-JJ dans le fuseau local de l'appareil. */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Assiduité : part des séances prévues effectivement réalisées (0–100),
 * ou null si aucune séance n'était prévue.
 */
export function adherenceRate(planned: number, done: number): number | null {
  if (planned <= 0) return null;
  return Math.round((Math.min(done, planned) / planned) * 100);
}
