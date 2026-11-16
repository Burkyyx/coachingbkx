import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Petit stockage clé/valeur persistant (préférences, session d'auth).
 * AsyncStorage utilise le localStorage du navigateur sur le web.
 */
export const kvStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};
