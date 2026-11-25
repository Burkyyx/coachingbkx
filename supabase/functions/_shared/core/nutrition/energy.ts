// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Besoins énergétiques (choix validés avec Enzo) :
 *   DEJ = métabolisme de base (Mifflin-St Jeor) × NAP hors sport + dépense nette des séances (lissée / jour).
 * Puis objectif selon le but, plancher (jamais sous le MB, ni sous 1 200 kcal) et macros.
 * TypeScript pur : testé unitairement, réutilisable côté serveur.
 */

export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
export type Goal = 'muscle_gain' | 'fat_loss' | 'recomposition' | 'performance' | 'health';

/** NAP hors sport (le sport est compté à part via les séances du programme). */
export const NAP_BY_ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.4,
  lightly_active: 1.5,
  moderately_active: 1.6,
  very_active: 1.75,
  extremely_active: 1.9,
};

/** Ajustement des calories selon l'objectif (part de la DEJ). */
export const GOAL_CALORIE_FACTOR: Record<Goal, number> = {
  fat_loss: -0.15,
  muscle_gain: 0.1,
  recomposition: 0,
  performance: 0,
  health: 0,
};

/** Plancher absolu, quel que soit le calcul. */
export const ABSOLUTE_FLOOR_KCAL = 1200;

/** Intensité moyenne (MET) : musculation ≈ 5, cardio ≈ 7. */
export const MET_STRENGTH = 5;
export const MET_CARDIO = 7;
/** Temps d'effort estimé pour une série en répétitions (s). */
export const SET_WORK_SECONDS = 40;

/** Métabolisme de base, Mifflin-St Jeor (kcal/j). « Autre » : moyenne homme/femme. */
export function mifflinStJeor(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const sexTerm = input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78;
  return base + sexTerm;
}

export type PlannedSetInput = {
  restSeconds: number | null;
  durationSeconds: number | null;
  cardio: boolean;
};
export type PlannedSessionInput = { sets: readonly PlannedSetInput[] };

/**
 * Dépense NETTE d'une séance (kcal) : (MET − 1) × poids × durée en heures.
 * On retire 1 MET car le repos est déjà compté dans MB × NAP.
 */
export function sessionNetKcal(session: PlannedSessionInput, weightKg: number): number {
  let kcal = 0;
  for (const set of session.sets) {
    const work = set.durationSeconds ?? SET_WORK_SECONDS;
    const seconds = work + (set.restSeconds ?? 90);
    const met = set.cardio ? MET_CARDIO : MET_STRENGTH;
    kcal += (met - 1) * weightKg * (seconds / 3600);
  }
  return kcal;
}

/** Durée estimée d'une séance (minutes), pour l'affichage du détail du calcul. */
export function sessionMinutes(session: PlannedSessionInput): number {
  const seconds = session.sets.reduce(
    (s, set) => s + (set.durationSeconds ?? SET_WORK_SECONDS) + (set.restSeconds ?? 90),
    0,
  );
  return Math.round(seconds / 60);
}

export type NutritionProfileInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal | null;
  /** Séances prévues sur une semaine type du programme. */
  weeklySessions: readonly PlannedSessionInput[];
  /** Réglages éventuels du coach (sinon valeurs par défaut). */
  napOverride?: number | null;
};

export type NutritionTargets = {
  bmr: number;
  nap: number;
  sessionsPerWeek: number;
  trainingKcalPerDay: number;
  tdee: number;
  goalFactor: number;
  floor: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Calcul complet des objectifs proposés (le coach peut ensuite tout ajuster). */
export function computeNutritionTargets(input: NutritionProfileInput): NutritionTargets {
  const bmr = mifflinStJeor(input);
  const nap = input.napOverride ?? NAP_BY_ACTIVITY[input.activityLevel];
  const weekly = input.weeklySessions.reduce((s, x) => s + sessionNetKcal(x, input.weightKg), 0);
  const trainingKcalPerDay = weekly / 7;
  const tdee = bmr * nap + trainingKcalPerDay;
  const goalFactor = input.goal ? GOAL_CALORIE_FACTOR[input.goal] : 0;
  const floor = Math.max(bmr, ABSOLUTE_FLOOR_KCAL);
  const kcal = Math.max(floor, tdee * (1 + goalFactor));
  const macros = macrosFor(round(kcal, 10), input.weightKg, input.goal);
  return {
    bmr: round(bmr),
    nap,
    sessionsPerWeek: input.weeklySessions.length,
    trainingKcalPerDay: round(trainingKcalPerDay),
    tdee: round(tdee, 10),
    goalFactor,
    floor: round(floor, 10),
    kcal: round(kcal, 10),
    ...macros,
  };
}

/**
 * Macros par défaut : protéines 1,8 g/kg (2 g/kg en sèche), lipides 1 g/kg,
 * glucides = le reste (jamais négatif).
 */
export function macrosFor(
  kcal: number,
  weightKg: number,
  goal: Goal | null,
): { proteinG: number; fatG: number; carbsG: number } {
  const proteinG = round(weightKg * (goal === 'fat_loss' ? 2 : 1.8));
  const fatG = round(weightKg * 1);
  const carbsG = Math.max(0, round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG };
}

/** Calories correspondant à des macros (4 / 4 / 9 kcal par gramme). */
export function kcalFromMacros(m: { proteinG: number; carbsG: number; fatG: number }): number {
  return m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9;
}
