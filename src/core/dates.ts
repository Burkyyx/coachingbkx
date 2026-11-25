/**
 * Dates « à la française ». Les dates sans heure sont au format ISO AAAA-MM-JJ.
 */

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const SHORT_MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** "31/12/1990" (ou "31-12-1990", "31.12.1990") → "1990-12-31" ; null si invalide. */
export function parseFrenchDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    return null;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "1990-12-31" → "31/12/1990". */
export function formatFrenchDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y: y ?? 1970, m: m ?? 1, d: d ?? 1 };
}

/** "2026-11-16" → "lundi 16 novembre". */
export function formatLongDate(iso: string, withYear = false): string {
  const { y, m, d } = parts(iso);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d === 1 ? '1er' : d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "2026-11-16" → "16 nov." */
export function formatShortDate(iso: string): string {
  const { m, d } = parts(iso);
  return `${d} ${SHORT_MONTHS[m - 1] ?? ''}`;
}

/** Heure locale "HH:MM" d'un horodatage ISO. */
export function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Temps écoulé en mots : « à l'instant », « il y a 5 min », « il y a 3 h »,
 * « hier », « il y a 4 jours », sinon la date courte.
 */
export function formatRelative(isoTimestamp: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(isoTimestamp).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return formatShortDate(new Date(isoTimestamp).toISOString());
}

/**
 * Saisie d'une date JJ/MM/AAAA : les « / » s'ajoutent tout seuls pendant la frappe
 * (et disparaissent avec l'effacement). `previous` = valeur avant la frappe.
 */
export function maskFrenchDate(text: string, previous = ''): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const deleting = text.length < previous.length;
  let out = digits.slice(0, 2);
  if (digits.length > 2 || (digits.length === 2 && !deleting)) out += '/';
  out += digits.slice(2, 4);
  if (digits.length > 4 || (digits.length === 4 && !deleting)) out += '/';
  out += digits.slice(4, 8);
  return out;
}
