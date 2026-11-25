import {
  dailyAverage,
  localDateOf,
  macrosForGrams,
  mealTypeForHour,
  progressOf,
  sumMacros,
} from '../nutrition/journal';

describe('journal alimentaire', () => {
  it('additionne les aliments', () => {
    expect(
      sumMacros([
        { kcal: 195, proteinG: 4, carbsG: 42, fatG: 0.5 },
        { kcal: 198, proteinG: 37, carbsG: 0, fatG: 4.5 },
      ]),
    ).toEqual({ kcal: 393, proteinG: 41, carbsG: 42, fatG: 5 });
  });

  it('convertit des valeurs pour 100 g à une quantité', () => {
    // Skyr : 63 kcal, 11 g prot., 4 g gluc., 0,2 g lip. pour 100 g → pot de 150 g
    expect(macrosForGrams({ kcal: 63, proteinG: 11, carbsG: 4, fatG: 0.2 }, 150)).toEqual({
      kcal: 94.5,
      proteinG: 16.5,
      carbsG: 6,
      fatG: 0.3,
    });
  });

  it('date locale à Paris (un repas à 0 h 30 compte pour le bon jour)', () => {
    expect(localDateOf('2026-11-25T23:30:00Z')).toBe('2026-11-26');
    expect(localDateOf('2026-11-25T12:00:00Z')).toBe('2026-11-25');
  });

  it('moyenne sur les jours saisis seulement', () => {
    const r = dailyAverage([
      {
        date: '2026-11-24',
        totals: { kcal: 2000, proteinG: 120, carbsG: 200, fatG: 70 },
        count: 3,
      },
      { date: '2026-11-25', totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, count: 0 },
      {
        date: '2026-11-26',
        totals: { kcal: 2400, proteinG: 140, carbsG: 260, fatG: 80 },
        count: 4,
      },
    ]);
    expect(r).toEqual({
      average: { kcal: 2200, proteinG: 130, carbsG: 230, fatG: 75 },
      loggedDays: 2,
    });
    expect(dailyAverage([]).loggedDays).toBe(0);
  });

  it('progression vers l’objectif et type de repas selon l’heure', () => {
    expect(progressOf(1210, 2420)).toBe(0.5);
    expect(progressOf(100, null)).toBeNull();
    expect(mealTypeForHour(8)).toBe('breakfast');
    expect(mealTypeForHour(12)).toBe('lunch');
    expect(mealTypeForHour(16)).toBe('snack');
    expect(mealTypeForHour(20)).toBe('dinner');
  });
});
