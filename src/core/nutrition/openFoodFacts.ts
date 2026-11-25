/**
 * Codes-barres et fiches produits Open Food Facts (API v2).
 * TypeScript pur : validation du code et lecture de la réponse, sans appel réseau.
 */

import type { Macros } from './journal.ts';

export type FoodProduct = {
  barcode: string;
  name: string;
  brand: string | null;
  /** Valeurs pour 100 g (ou 100 ml). */
  per100g: Macros;
  /** Portion indiquée par le fabricant (g), si connue. */
  servingG: number | null;
  /** Une des valeurs principales manque (kcal ou macros) : à vérifier par l'adhérent. */
  incomplete: boolean;
};

/** Garde uniquement les chiffres d'une saisie (espaces, tirets…). */
export function cleanBarcode(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Code EAN-8, UPC-A (12), EAN-13 ou GTIN-14 valide (clé de contrôle comprise).
 */
export function isValidBarcode(input: string): boolean {
  const code = cleanBarcode(input);
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop() as number;
  // Poids 3 puis 1 en partant du chiffre le plus proche de la clé.
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** URL de l'API pour un code (champs limités au nécessaire). */
export function openFoodFactsUrl(barcode: string): string {
  const fields = [
    'code',
    'product_name',
    'product_name_fr',
    'generic_name_fr',
    'brands',
    'serving_quantity',
    'nutriments',
  ].join(',');
  return `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode(barcode)}.json?fields=${fields}`;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Lit la réponse de l'API. null si le produit est inconnu ou sans aucune valeur utile.
 * Les kcal manquantes sont recalculées depuis les kJ, puis depuis les macros.
 */
export function parseOpenFoodFacts(json: unknown, barcode: string): FoodProduct | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as { status?: unknown; product?: Record<string, unknown> };
  if (root.status !== 1 && root.status !== 'success') {
    if (!root.product) return null;
  }
  const p = root.product;
  if (!p || typeof p !== 'object') return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  const protein = toNumber(n.proteins_100g);
  const carbs = toNumber(n.carbohydrates_100g);
  const fat = toNumber(n.fat_100g);
  let kcal = toNumber(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = toNumber(n['energy-kj_100g']) ?? toNumber(n.energy_100g);
    if (kj !== null) kcal = kj / 4.184;
  }
  if (kcal === null && protein !== null && carbs !== null && fat !== null) {
    kcal = protein * 4 + carbs * 4 + fat * 9;
  }
  if (kcal === null && protein === null && carbs === null && fat === null) return null;

  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const name =
    text(p.product_name_fr) ?? text(p.product_name) ?? text(p.generic_name_fr) ?? 'Produit';
  const brand = text(p.brands)?.split(',')[0]?.trim() ?? null;
  const serving = toNumber(p.serving_quantity);

  return {
    barcode: cleanBarcode(barcode),
    name: name.slice(0, 120),
    brand,
    per100g: {
      kcal: Math.round(kcal ?? 0),
      proteinG: round1(protein ?? 0),
      carbsG: round1(carbs ?? 0),
      fatG: round1(fat ?? 0),
    },
    servingG: serving !== null && serving > 0 && serving <= 2000 ? serving : null,
    incomplete: kcal === null || protein === null || carbs === null || fat === null,
  };
}
