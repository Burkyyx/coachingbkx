// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/** Arrondit à un multiple de `step` (ex. 2,5 kg). */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

/** Arrondit vers le bas à un multiple de `step`. */
export function floorToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.floor(value / step + 1e-9) * step * 1000) / 1000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Valeur la plus fréquente (en cas d'égalité : la plus grande). */
export function mode(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount || (c === bestCount && best !== null && v > best)) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}
