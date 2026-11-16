import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences } from '@/stores/preferences';

import { buildTheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(buildTheme('dark'));

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = usePreferences((s) => s.theme);
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Accès au thème courant depuis n'importe quel composant. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}
