/**
 * Mise en forme des nombres « à la française » (virgule décimale), sans dépendance
 * à l'environnement (utilisable dans l'app ET dans les fonctions serveur).
 */

/** 62.5 → "62,5" ; 60 → "60" ; 2.25 → "2,25". */
export function formatNumber(value: number, maxDecimals = 2): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded).replace('.', ',');
}

/** Entier avec espace (fine insécable) des milliers : 1349.4 → "1 349" ; −2500 → "−2 500". */
export function formatInt(value: number): string {
  const n = Math.round(value);
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  return n < 0 ? `−${digits}` : digits;
}

/** 62.5 → "62,5 kg". */
export function formatKg(value: number): string {
  return `${formatNumber(value)} kg`;
}

/** Signe explicite : 2.5 → "+2,5" ; -5 → "−5". */
export function formatSigned(value: number, maxDecimals = 2): string {
  const s = formatNumber(Math.abs(value), maxDecimals);
  return value >= 0 ? `+${s}` : `−${s}`;
}

/** 90 → "1 min 30" ; 45 → "45 s" ; 120 → "2 min". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r === 0 ? `${m} min` : `${m} min ${String(r).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h} h` : `${h} h ${String(rm).padStart(2, '0')}`;
}

/** Minuteur : 95 → "1:35". */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Fourchette de répétitions : (8, 12) → "8–12" ; (10, 10) → "10". */
export function formatRepRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return '—';
  if (min === null) return String(max);
  if (max === null || max === min) return String(min);
  return `${min}–${max}`;
}
