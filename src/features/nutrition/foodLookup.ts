import { Platform } from 'react-native';

import { openFoodFactsUrl, parseOpenFoodFacts, type FoodProduct } from '@/core';

/**
 * Recherche d'un produit par code-barres dans Open Food Facts (base publique et collaborative).
 * Seul le code-barres est envoyé. null si le produit est inconnu.
 */
export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  const res = await fetch(openFoodFactsUrl(barcode), {
    // Open Food Facts demande d'identifier l'application (impossible depuis un navigateur).
    headers: Platform.OS === 'web' ? undefined : { 'User-Agent': 'Divus/1.0 (coaching)' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`openfoodfacts_${res.status}`);
  return parseOpenFoodFacts(await res.json(), barcode);
}
