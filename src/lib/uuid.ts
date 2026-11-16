import * as ExpoCrypto from 'expo-crypto';

import { sha256Hex } from './sha256';

/**
 * Sur le web, `crypto.randomUUID` et `crypto.subtle` n'existent que sur une adresse
 * sécurisée (https ou localhost). Sur une adresse http du réseau local (téléphone qui
 * ouvre l'app du Mac), on utilise des replis équivalents.
 */
const webCrypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } })
  .crypto;

/**
 * Identifiant unique généré sur l'appareil. Indispensable pour le hors-ligne :
 * une même séance renvoyée deux fois à la synchro garde le même identifiant,
 * donc pas de doublon.
 */
export function uuid(): string {
  try {
    return ExpoCrypto.randomUUID();
  } catch {
    return randomUuidFallback();
  }
}

/** UUID v4 à partir de `getRandomValues` (disponible même hors contexte sécurisé). */
export function randomUuidFallback(): string {
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  let hash: string;
  try {
    hash = await ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, key);
  } catch {
    hash = sha256Hex(key);
  }
  return hexToUuid(hash);
}
