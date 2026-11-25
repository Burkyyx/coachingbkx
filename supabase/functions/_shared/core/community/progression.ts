// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Progression (Phase 3) : niveaux, badges, barème d'XP. TypeScript pur, testé.
 * Les XP sont attribués par la base (déclencheurs) ; ce module sert à l'affichage
 * et aux réglages du coach. Rien n'y dépend du poids, des calories ou de l'apparence.
 */

/** XP minimum de chaque niveau (8 niveaux ; noms dans les traductions : community.levels.<index>). */
export const LEVEL_THRESHOLDS = [0, 200, 600, 1200, 2200, 3600, 5500, 8000] as const;

export type LevelInfo = {
  /** 0 → 7 */
  index: number;
  min: number;
  /** XP du niveau suivant (null au niveau maximum). */
  next: number | null;
  /** Avancement vers le niveau suivant (0 → 1 ; 1 au niveau maximum). */
  progress: number;
};

export function levelFor(xp: number): LevelInfo {
  const total = Math.max(0, Math.floor(xp));
  let index = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (total >= (LEVEL_THRESHOLDS[i] ?? Infinity)) index = i;
  }
  const min = LEVEL_THRESHOLDS[index] ?? 0;
  const next = LEVEL_THRESHOLDS[index + 1] ?? null;
  return {
    index,
    min,
    next,
    progress: next === null ? 1 : Math.min(1, (total - min) / (next - min)),
  };
}

/** Badges attribués par la base (textes : community.badges.<clé>). */
export const BADGE_KEYS = [
  'first_session',
  'sessions_10',
  'sessions_50',
  'sessions_100',
  'streak_4_weeks',
  'first_record',
  'challenge_won',
] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export function isBadgeKey(value: string): value is BadgeKey {
  return (BADGE_KEYS as readonly string[]).includes(value);
}

/** Barème d'XP (réglé par le coach). */
export type XpRules = {
  session: number;
  checkin: number;
  full_week: number;
  record: number;
  record_max_per_session: number;
  challenge: number;
  journal_day: number;
  daily_cap: number;
};

export const DEFAULT_XP_RULES: XpRules = {
  session: 20,
  checkin: 15,
  full_week: 30,
  record: 10,
  record_max_per_session: 3,
  challenge: 50,
  journal_day: 10,
  daily_cap: 100,
};

/** Bornes acceptées (anti-abus) : chaque gain ≤ 500 XP, plafond quotidien ≤ 2 000. */
const LIMITS: Record<keyof XpRules, number> = {
  session: 500,
  checkin: 500,
  full_week: 500,
  record: 500,
  record_max_per_session: 20,
  challenge: 500,
  journal_day: 500,
  daily_cap: 2000,
};

/** Barème lu en base (JSON partiel ou invalide) → valeurs entières bornées. */
export function sanitizeXpRules(raw: unknown): XpRules {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_XP_RULES };
  for (const key of Object.keys(DEFAULT_XP_RULES) as (keyof XpRules)[]) {
    const v = Number(src[key]);
    if (Number.isFinite(v)) out[key] = Math.min(LIMITS[key], Math.max(0, Math.round(v)));
  }
  return out;
}

/** Avancement d'un challenge (0 → 1). */
export function challengeProgress(progress: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.min(1, Math.max(0, progress / target));
}
