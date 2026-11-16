import * as Crypto from 'expo-crypto';

/**
 * Identifiant unique généré sur l'appareil. Indispensable pour le hors-ligne :
 * une même séance renvoyée deux fois à la synchro garde le même identifiant,
 * donc pas de doublon.
 */
export function uuid(): string {
  return Crypto.randomUUID();
}
