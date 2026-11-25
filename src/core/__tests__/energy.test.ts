import {
  computeNutritionTargets,
  kcalFromMacros,
  macrosFor,
  mifflinStJeor,
  sessionMinutes,
  sessionNetKcal,
  type PlannedSessionInput,
} from '../nutrition/energy';

// Séance type : 15 séries de musculation, 90 s de repos → 15 × (40 + 90) s = 32,5 min.
const strength: PlannedSessionInput = {
  sets: Array.from({ length: 15 }, () => ({
    restSeconds: 90,
    durationSeconds: null,
    cardio: false,
  })),
};

describe('métabolisme de base (Mifflin-St Jeor)', () => {
  it('homme 80 kg, 180 cm, 30 ans → 1 780 kcal', () => {
    // 10×80 + 6,25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5
    expect(mifflinStJeor({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 })).toBe(1780);
  });

  it('femme 60 kg, 165 cm, 25 ans → 1 345,25 kcal', () => {
    // 600 + 1031,25 − 125 − 161
    expect(mifflinStJeor({ sex: 'female', weightKg: 60, heightCm: 165, age: 25 })).toBeCloseTo(
      1345.25,
    );
  });
});

describe('dépense des séances', () => {
  it('compte la dépense NETTE : (MET − 1) × poids × heures', () => {
    // 32,5 min à 5 MET pour 80 kg : 4 × 80 × 0,5417 = 173,3 kcal
    expect(sessionNetKcal(strength, 80)).toBeCloseTo(173.33, 1);
    expect(sessionMinutes(strength)).toBe(33);
  });

  it('le cardio chronométré compte plus', () => {
    const cardio: PlannedSessionInput = {
      sets: [{ restSeconds: 0, durationSeconds: 1800, cardio: true }],
    };
    // 30 min à 7 MET pour 80 kg : 6 × 80 × 0,5 = 240 kcal
    expect(sessionNetKcal(cardio, 80)).toBeCloseTo(240);
  });
});

describe('objectifs complets', () => {
  const base = {
    sex: 'male' as const,
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: 'moderately_active' as const,
    weeklySessions: [strength, strength, strength],
  };

  it('DEJ = MB × NAP + séances lissées sur 7 jours', () => {
    const r = computeNutritionTargets({ ...base, goal: 'recomposition' });
    // 1780 × 1,6 = 2848 ; + 3 × 173,3 / 7 = 74,3 → 2922,3 → arrondi à 2 920
    expect(r.bmr).toBe(1780);
    expect(r.nap).toBe(1.6);
    expect(r.trainingKcalPerDay).toBe(74);
    expect(r.tdee).toBe(2920);
    expect(r.kcal).toBe(2920);
  });

  it('sèche −15 %, prise de masse +10 %', () => {
    expect(computeNutritionTargets({ ...base, goal: 'fat_loss' }).kcal).toBe(2480);
    expect(computeNutritionTargets({ ...base, goal: 'muscle_gain' }).kcal).toBe(3210);
  });

  it('ne descend jamais sous le métabolisme de base (ni sous 1 200 kcal)', () => {
    const r = computeNutritionTargets({
      sex: 'female',
      weightKg: 45,
      heightCm: 150,
      age: 60,
      activityLevel: 'sedentary',
      goal: 'fat_loss',
      weeklySessions: [],
    });
    // MB = 450 + 937,5 − 300 − 161 = 926,5 → plancher absolu 1 200 kcal
    expect(r.floor).toBe(1200);
    expect(r.kcal).toBe(1200);
  });

  it('macros : protéines 2 g/kg en sèche, lipides 1 g/kg, glucides = reste', () => {
    const m = macrosFor(2480, 80, 'fat_loss');
    // glucides = (2480 − 160×4 − 80×9) / 4 = 280 g
    expect(m).toEqual({ proteinG: 160, fatG: 80, carbsG: 280 });
    expect(kcalFromMacros(m)).toBe(2480);
  });

  it('le NAP peut être forcé par le coach', () => {
    expect(computeNutritionTargets({ ...base, goal: null, napOverride: 1.4 }).nap).toBe(1.4);
  });
});
