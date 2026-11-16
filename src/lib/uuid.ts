import * as Crypto from 'expo-crypto';

/**
 * Identifiant unique généré sur l'appareil. Indispensable pour le hors-ligne :
 * une même séance renvoyée deux fois à la synchro garde le même identifiant,
 * donc pas de doublon.
 */
export function uuid(): string {
  return Crypto.randomUUID();
}

/** Met en forme 32 caractères hexadécimaux en identifiant UUID. */
export function hexToUuid(hex: string): string {
  const h = hex.toLowerCase().padEnd(32, '0').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Identifiant STABLE dérivé d'une clé (ex. « bilan de la semaine X de l'adhérent Y ») :
 * le même élément reçoit toujours le même identifiant, même saisi hors-ligne deux fois.
 */
export async function stableUuid(key: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
  return hexToUuid(hash);
}
