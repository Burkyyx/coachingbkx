import {
  MEAL_ANALYSIS_SCHEMA,
  aiCostUsd,
  mealAnalysisPrompt,
  parseMealAnalysis,
} from '../nutrition/mealAnalysis';

const item = {
  name: 'Riz basmati cuit',
  quantity_g: 180,
  kcal: 234,
  protein_g: 4.9,
  carbs_g: 50.4,
  fat_g: 0.5,
  confidence: 'medium',
};

describe('analyse photo : validation de la réponse', () => {
  it('lit une réponse correcte', () => {
    const r = parseMealAnalysis(JSON.stringify({ is_food: true, items: [item], note: '' }));
    expect(r).toEqual({
      isFood: true,
      note: '',
      items: [
        {
          name: 'Riz basmati cuit',
          quantityG: 180,
          kcal: 234,
          proteinG: 4.9,
          carbsG: 50.4,
          fatG: 0.5,
          confidence: 'medium',
        },
      ],
    });
  });

  it('écarte les aliments aberrants sans rejeter le reste', () => {
    const r = parseMealAnalysis(
      JSON.stringify({
        is_food: true,
        items: [item, { ...item, name: 'Erreur', kcal: -5 }, { ...item, name: '  ', kcal: 10 }],
        note: 'Sauce non visible.',
      }),
    );
    expect(r?.items.map((i) => i.name)).toEqual(['Riz basmati cuit']);
    expect(r?.note).toBe('Sauce non visible.');
  });

  it('photo sans nourriture, JSON invalide ou réponse vide', () => {
    expect(parseMealAnalysis('{"is_food":false,"items":[],"note":""}')).toEqual({
      isFood: false,
      items: [],
      note: '',
    });
    expect(parseMealAnalysis('pas du json')).toBeNull();
    expect(parseMealAnalysis('{"is_food":true,"items":[],"note":""}')).toBeNull();
    expect(parseMealAnalysis(null)).toBeNull();
  });

  it('schéma fermé (exigence des sorties structurées) et consigne', () => {
    expect(MEAL_ANALYSIS_SCHEMA.additionalProperties).toBe(false);
    expect(MEAL_ANALYSIS_SCHEMA.properties.items.items.additionalProperties).toBe(false);
    expect(mealAnalysisPrompt('  pâtes   carbo ')).toBe(
      'Analyse ce repas. Précision de l’utilisateur : « pâtes carbo »',
    );
    expect(mealAnalysisPrompt('')).toBe('Analyse ce repas.');
  });

  it('coût estimé', () => {
    expect(aiCostUsd('claude-haiku-5-5', 2000, 500)).toBe(0.00045);
    expect(aiCostUsd('modele-inconnu', 2000, 500)).toBe(0);
  });
});
