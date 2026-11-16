import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fr } from './locales/fr';

/**
 * Internationalisation.
 * L'interface est en français uniquement pour l'instant. Pour ajouter une langue :
 * 1. créer `locales/en.ts` avec la même structure que `fr.ts` ;
 * 2. l'ajouter dans `resources` ci-dessous.
 */
export const defaultNS = 'translation';
export const resources = {
  fr: { translation: fr },
} as const;

// eslint-disable-next-line import/no-named-as-default-member -- API officielle d'i18next
void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  resources,
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
