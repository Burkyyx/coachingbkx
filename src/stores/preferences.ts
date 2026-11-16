import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/kvStorage';

/** Préférences locales de l'appareil (non synchronisées avec le serveur). */
export type ThemePreference = 'dark' | 'light' | 'system';

type PreferencesState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      // Mode sombre par défaut (spec §12).
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => kvStorage),
    },
  ),
);
