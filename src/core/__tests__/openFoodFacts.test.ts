import {
  cleanBarcode,
  isValidBarcode,
  openFoodFactsUrl,
  parseOpenFoodFacts,
} from '../nutrition/openFoodFacts';

describe('codes-barres', () => {
  it('valide la clé de contrôle (EAN-13, EAN-8, UPC-A)', () => {
    expect(isValidBarcode('3017620422003')).toBe(true);
    expect(isValidBarcode('3017620422004')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true);
    expect(isValidBarcode('036000291452')).toBe(true);
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('3 017620 422003')).toBe(true);
  });

  it('nettoie la saisie et construit l’URL', () => {
    expect(cleanBarcode(' 3017-6204 22003 ')).toBe('3017620422003');
    expect(openFoodFactsUrl('3017620422003')).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/3017620422003\.json\?fields=/,
    );
  });
});

describe('fiche Open Food Facts', () => {
  it('lit le nom français, la marque, les valeurs pour 100 g et la portion', () => {
    const p = parseOpenFoodFacts(
      {
        code: '3017620422003',
        status: 1,
        product: {
          product_name: 'Nutella',
          product_name_fr: 'Pâte à tartiner noisettes cacao',
          brands: 'Ferrero, Nutella',
          serving_quantity: 15,
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
          },
        },
      },
      '3017620422003',
    );
    expect(p).toEqual({
      barcode: '3017620422003',
      name: 'Pâte à tartiner noisettes cacao',
      brand: 'Ferrero',
      per100g: { kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9 },
      servingG: 15,
      incomplete: false,
    });
  });

  it('recalcule les kcal depuis les kJ et signale une fiche incomplète', () => {
    const p = parseOpenFoodFacts(
      { status: 1, product: { product_name: 'Skyr', nutriments: { 'energy-kj_100g': 264 } } },
      '1234567890128',
    );
    expect(p?.per100g.kcal).toBe(63);
    expect(p?.incomplete).toBe(true);
    expect(p?.servingG).toBeNull();
  });

  it('produit inconnu ou sans valeurs → null', () => {
    expect(parseOpenFoodFacts({ status: 0, status_verbose: 'product not found' }, '1')).toBeNull();
    expect(parseOpenFoodFacts({ status: 1, product: { product_name: 'X' } }, '1')).toBeNull();
    expect(parseOpenFoodFacts(null, '1')).toBeNull();
  });
});
