import {
  adjustMacrosForKcal,
  deficitPerformanceAlert,
  observedWeeklyRate,
  performanceTrend,
  suggestCalorieAdjustment,
  type StrengthEntry,
} from '../nutrition/calorieAdjust';
import { addDays } from '../metrics/schedule';

const TODAY = '2026-11-25';
/** Pesées quotidiennes sur `days` jours, à `ratePct` % du poids par semaine. */
function series(start: number, ratePct: number, days = 21) {
  return Array.from({ length: days + 1 }, (_, i) => ({
    date: addDays(TODAY, i - days),
    kg: Math.round(start * (1 + ((ratePct / 100) * i) / 7) * 100) / 100,
  }));
}
const targets = {
  kcal: 2200,
  proteinG: 140,
  carbsG: 240,
  fatG: 70,
  floorKcal: 1500,
  weeklyRateTarget: null,
};

describe('ajustement des calories', () => {
  it('aucune proposition quand le poids suit la trajectoire (sèche −0,5 %/sem.)', () => {
    expect(
      suggestCalorieAdjustment({
        weights: series(80, -0.5),
        today: TODAY,
        targets,
        goal: 'fat_loss',
      }),
    ).toBeNull();
  });

  it('sèche qui stagne → −150 kcal, seuls les glucides baissent', () => {
    const s = suggestCalorieAdjustment({
      weights: series(80, 0),
      today: TODAY,
      targets,
      goal: 'fat_loss',
    });
    expect(s?.deltaKcal).toBe(-150);
    expect(s?.proposed).toEqual({ kcal: 2050, proteinG: 140, carbsG: 203, fatG: 70 });
    expect(s?.reason).toBe('above_target');
    expect(s?.justification).toContain('2\u202f200 → 2\u202f050 kcal');
  });

  it('prise de masse trop lente → +100 kcal', () => {
    const s = suggestCalorieAdjustment({
      weights: series(70, -0.05),
      today: TODAY,
      targets,
      goal: 'muscle_gain',
    });
    expect(s?.deltaKcal).toBe(100);
  });

  it('perte de plus de 1 %/sem. → +150 kcal, quel que soit l’objectif', () => {
    const s = suggestCalorieAdjustment({
      weights: series(80, -1.4),
      today: TODAY,
      targets: { ...targets, weeklyRateTarget: -1.2 },
      goal: 'fat_loss',
    });
    expect(s?.deltaKcal).toBe(150);
    expect(s?.reason).toBe('too_fast_loss');
  });

  it('respecte le plancher et ne propose rien si déjà au plancher', () => {
    const atFloor = { ...targets, kcal: 1500 };
    expect(
      suggestCalorieAdjustment({
        weights: series(80, 0),
        today: TODAY,
        targets: atFloor,
        goal: 'fat_loss',
      }),
    ).toBeNull();
    const near = suggestCalorieAdjustment({
      weights: series(80, 0),
      today: TODAY,
      targets: { ...targets, kcal: 1560 },
      goal: 'fat_loss',
    });
    expect(near?.proposed.kcal).toBe(1500);
  });

  it('données insuffisantes : trop peu de pesées ou trop anciennes', () => {
    expect(observedWeeklyRate(series(80, -0.5, 10), TODAY)).toBeNull();
    const old = series(80, -0.5).map((w) => ({ ...w, date: addDays(w.date, -10) }));
    expect(observedWeeklyRate(old, TODAY)).toBeNull();
    expect(observedWeeklyRate(series(80, -0.5), TODAY)).toBeLessThan(-0.3);
  });

  it('macros : les lipides compensent si les glucides passeraient sous zéro', () => {
    expect(adjustMacrosForKcal({ kcal: 1300, proteinG: 150, carbsG: 20, fatG: 50 }, 1150)).toEqual({
      kcal: 1150,
      proteinG: 150,
      carbsG: 0,
      fatG: 42,
    });
  });
});

describe('déficit + performances en baisse', () => {
  const entries = (pctRecent: number): StrengthEntry[] =>
    ['squat', 'bench', 'row'].flatMap((exerciseId) => [
      { date: addDays(TODAY, -30), exerciseId, best1RM: 100 },
      { date: addDays(TODAY, -20), exerciseId, best1RM: 100 },
      { date: addDays(TODAY, -5), exerciseId, best1RM: 100 * (1 + pctRecent / 100) },
    ]);

  it('détecte une baisse de force pendant une perte de poids', () => {
    const perf = performanceTrend(entries(-8), TODAY);
    expect(perf).toEqual({ comparedExercises: 3, droppedExercises: 3, averageChangePct: -8 });
    expect(deficitPerformanceAlert(-0.6, perf)).toContain('3/3 exercices en recul');
  });

  it('pas d’alerte si le poids est stable ou si la force tient', () => {
    expect(deficitPerformanceAlert(0, performanceTrend(entries(-8), TODAY))).toBeNull();
    expect(deficitPerformanceAlert(-0.6, performanceTrend(entries(-2), TODAY))).toBeNull();
    expect(performanceTrend(entries(-8).slice(0, 3), TODAY)).toBeNull();
  });
});
