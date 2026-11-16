/**
 * PARAMÈTRES DES ALGORITHMES DE SUGGESTION (spec §8)
 * --------------------------------------------------
 * Chaque règle a des valeurs par défaut prudentes, que le coach peut surcharger :
 *   global → par adhérent → par exercice → par adhérent ET exercice (le plus précis gagne).
 * Les surcharges sont stockées dans la table `progression_rules` (colonne `params`).
 */

export type RuleKey = 'double_progression' | 'stagnation' | 'fatigue' | 'rest_time';

export type DoubleProgressionParams = {
  /** Nombre de séances d'affilée en haut de fourchette avant de proposer une hausse. */
  sessionsAtTopRequired: number;
  /** Nombre de séances d'affilée sous la fourchette avant de proposer une baisse. */
  sessionsBelowRequired: number;
  /** Baisse de charge proposée (en %, la spec indique 5 à 10 %). */
  decreasePercent: number;
  /** Proposer « garder la charge et viser +1 rep » quand les reps sont dans la fourchette. */
  suggestRepTarget: boolean;
};

export type StagnationParams = {
  /** Nombre de séances sans progression avant l'alerte. */
  sessions: number;
  /** Amélioration minimale du 1RM estimé (en %) pour compter comme une progression. */
  minImprovementPercent: number;
  /** Action proposée en priorité. */
  preferredAction: 'variation' | 'rep_range' | 'deload';
};

export type FatigueParams = {
  /** Nombre de séances récentes analysées. */
  lookbackSessions: number;
  /** Ressenti moyen (1–10) à partir duquel la séance est jugée très difficile. */
  ratingThreshold: number;
  /** Écart moyen (RIR cible − RIR réel) à partir duquel on considère que l'adhérent force trop. */
  rirDeficit: number;
  /** Baisse du 1RM estimé (en %) considérée comme une baisse de performance. */
  performanceDropPercent: number;
  /** Note de sommeil ou d'énergie (1–5) en dessous ou égale à laquelle le bilan est jugé bas. */
  lowWellbeing: number;
  /** Nombre minimum de signaux de fatigue simultanés pour proposer une décharge. */
  minSignals: number;
  /** Multiplicateur du volume pendant la décharge (0,5 = −50 % ; la spec indique −40 à −50 %). */
  volumeFactor: number;
};

export type RestTimeParams = {
  /** Repos réel ≥ repos prescrit × ratio → repos « très supérieur ». */
  ratio: number;
  /** Et au moins ce nombre de secondes de plus que prévu. */
  minExtraSeconds: number;
  /** Part minimale des séries concernées dans une séance. */
  minShare: number;
  /** Séances récentes analysées. */
  lookbackSessions: number;
  /** Nombre de séances concernées pour prévenir le coach (« de façon répétée »). */
  minSessions: number;
};

export type RuleParams = {
  double_progression: DoubleProgressionParams;
  stagnation: StagnationParams;
  fatigue: FatigueParams;
  rest_time: RestTimeParams;
};

export const DEFAULT_PARAMS: RuleParams = {
  double_progression: {
    sessionsAtTopRequired: 1,
    sessionsBelowRequired: 2,
    decreasePercent: 7.5,
    suggestRepTarget: true,
  },
  stagnation: {
    sessions: 3,
    minImprovementPercent: 0.5,
    preferredAction: 'variation',
  },
  fatigue: {
    lookbackSessions: 3,
    ratingThreshold: 8,
    rirDeficit: 1.5,
    performanceDropPercent: 5,
    lowWellbeing: 2,
    minSignals: 2,
    volumeFactor: 0.5,
  },
  rest_time: {
    ratio: 1.5,
    minExtraSeconds: 30,
    minShare: 0.5,
    lookbackSessions: 3,
    minSessions: 2,
  },
};

/** Limites de sécurité appliquées aux valeurs saisies par le coach. */
const BOUNDS: { [K in RuleKey]: Partial<Record<keyof RuleParams[K], [number, number]>> } = {
  double_progression: {
    sessionsAtTopRequired: [1, 6],
    sessionsBelowRequired: [1, 6],
    decreasePercent: [2.5, 20],
  },
  stagnation: { sessions: [2, 8], minImprovementPercent: [0, 10] },
  fatigue: {
    lookbackSessions: [2, 8],
    ratingThreshold: [5, 10],
    rirDeficit: [0.5, 5],
    performanceDropPercent: [1, 20],
    lowWellbeing: [1, 4],
    minSignals: [1, 4],
    volumeFactor: [0.4, 0.8],
  },
  rest_time: {
    ratio: [1.1, 4],
    minExtraSeconds: [0, 600],
    minShare: [0.1, 1],
    lookbackSessions: [1, 8],
    minSessions: [1, 8],
  },
};

/** Ligne de la table progression_rules. */
export type RuleRow = {
  ruleKey: RuleKey;
  adherentId: string | null;
  exerciseId: string | null;
  params: Record<string, unknown>;
  enabled: boolean;
  autoApply: boolean;
};

export type ResolvedRule<K extends RuleKey> = {
  params: RuleParams[K];
  enabled: boolean;
  autoApply: boolean;
};

/** Ne garde que les clés connues, du bon type, dans les bornes autorisées. */
export function sanitizeParams<K extends RuleKey>(
  ruleKey: K,
  raw: Record<string, unknown>,
): Partial<RuleParams[K]> {
  const defaults = DEFAULT_PARAMS[ruleKey] as Record<string, unknown>;
  const bounds = BOUNDS[ruleKey] as Record<string, [number, number] | undefined>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in defaults)) continue;
    const def = defaults[key];
    if (typeof def === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      const b = bounds[key];
      out[key] = b ? Math.min(b[1], Math.max(b[0], value)) : value;
    } else if (typeof def === 'boolean' && typeof value === 'boolean') {
      out[key] = value;
    } else if (
      key === 'preferredAction' &&
      ['variation', 'rep_range', 'deload'].includes(String(value))
    ) {
      out[key] = value;
    }
  }
  return out as Partial<RuleParams[K]>;
}

/** Niveau de précision d'une ligne (plus c'est haut, plus elle est prioritaire). */
function specificity(row: RuleRow): number {
  return (row.adherentId ? 1 : 0) + (row.exerciseId ? 2 : 0);
}

/**
 * Calcule la règle effective pour un adhérent (et éventuellement un exercice).
 * Les paramètres se cumulent du plus général au plus précis.
 */
export function resolveRule<K extends RuleKey>(
  ruleKey: K,
  rows: readonly RuleRow[],
  adherentId: string,
  exerciseId: string | null = null,
): ResolvedRule<K> {
  const applicable = rows
    .filter(
      (r) =>
        r.ruleKey === ruleKey &&
        (r.adherentId === null || r.adherentId === adherentId) &&
        (r.exerciseId === null || r.exerciseId === exerciseId),
    )
    .sort((a, b) => specificity(a) - specificity(b));

  let params = { ...DEFAULT_PARAMS[ruleKey] } as RuleParams[K];
  let enabled = true;
  let autoApply = false;
  for (const row of applicable) {
    params = { ...params, ...sanitizeParams(ruleKey, row.params) };
    enabled = row.enabled;
    autoApply = row.autoApply;
  }
  return { params, enabled, autoApply };
}
