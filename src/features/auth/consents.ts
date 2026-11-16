import type { Enums } from '@/lib/supabase';

export type ConsentType = Enums<'consent_type'>;

/**
 * Version des textes juridiques. À incrémenter quand les CGU ou la politique de
 * confidentialité changent : chaque adhérent devra alors ré-accepter.
 */
export const CONSENT_VERSION = '1.0';

/** Consentements demandés à l'inscription (Phase 1). */
export const SIGNUP_CONSENTS: readonly ConsentType[] = ['terms', 'training_data'];
/** Consentements obligatoires pour utiliser l'app. */
export const REQUIRED_CONSENTS: readonly ConsentType[] = ['terms', 'training_data'];
/**
 * Consentements demandés plus tard, à l'arrivée de la fonctionnalité concernée :
 * health_data (pesées, Phase 1 bilan + Phase 2 nutrition), ai_photo (Phase 2), community (Phase 3).
 */
export const LATER_CONSENTS: readonly ConsentType[] = ['health_data', 'ai_photo', 'community'];

export type ConsentRow = { type: ConsentType; version: string; revoked_at: string | null };

export function hasActiveConsent(consents: readonly ConsentRow[], type: ConsentType): boolean {
  return consents.some(
    (c) => c.type === type && c.revoked_at === null && c.version === CONSENT_VERSION,
  );
}

export function missingRequiredConsents(consents: readonly ConsentRow[]): ConsentType[] {
  return REQUIRED_CONSENTS.filter((t) => !hasActiveConsent(consents, t));
}

/** Âge en années révolues à une date donnée. */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = (ty ?? 0) - (by ?? 0);
  if ((tm ?? 0) < (bm ?? 0) || ((tm ?? 0) === (bm ?? 0) && (td ?? 0) < (bd ?? 0))) age--;
  return age;
}

/** Âge minimum pour utiliser l'app (pas de consentement parental géré : choix du coach). */
export const MINIMUM_AGE = 15;
