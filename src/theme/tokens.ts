/**
 * THÈME CENTRALISÉ
 * ----------------
 * Toutes les couleurs, tailles et espacements de l'app sont définis ici.
 * Pour changer l'identité visuelle (ex. passer d'un noir & blanc à une couleur
 * principale orange), il suffit de modifier `palette` et `brand` ci-dessous.
 */

export type ColorScheme = 'dark' | 'light';

/** Couleur "signature" de la marque. Noir & blanc pour l'instant. */
const brand = {
  dark: { primary: '#FFFFFF', onPrimary: '#0A0A0A' },
  light: { primary: '#0A0A0A', onPrimary: '#FFFFFF' },
};

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  onPrimary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** Or : réservé aux records et récompenses. */
  highlight: string;
  overlay: string;
  chart: readonly string[];
};

export const colors: Record<ColorScheme, ThemeColors> = {
  dark: {
    background: '#0A0A0A',
    surface: '#151515',
    surfaceAlt: '#1F1F1F',
    border: '#2E2E2E',
    text: '#FAFAFA',
    textMuted: '#A3A3A3',
    textSubtle: '#737373',
    ...brand.dark,
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#93C5FD',
    highlight: '#FACC15',
    overlay: 'rgba(0,0,0,0.6)',
    chart: ['#FAFAFA', '#93C5FD', '#FACC15', '#4ADE80', '#F87171'],
  },
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceAlt: '#EBEBEB',
    border: '#D4D4D4',
    text: '#0A0A0A',
    textMuted: '#525252',
    textSubtle: '#737373',
    ...brand.light,
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    info: '#1D4ED8',
    highlight: '#A16207',
    overlay: 'rgba(0,0,0,0.4)',
    chart: ['#0A0A0A', '#1D4ED8', '#A16207', '#15803D', '#B91C1C'],
  },
};

/** Nutrition : une couleur par macro et par composante de la dépense énergétique. */
export type NutritionColors = {
  protein: string;
  carbs: string;
  fat: string;
  bmr: string;
  activity: string;
  training: string;
};

export const nutritionColors: Record<ColorScheme, NutritionColors> = {
  dark: {
    protein: '#F87171',
    carbs: '#FBBF24',
    fat: '#60A5FA',
    bmr: '#A78BFA',
    activity: '#34D399',
    training: '#FB923C',
  },
  light: {
    protein: '#DC2626',
    carbs: '#D97706',
    fat: '#2563EB',
    bmr: '#7C3AED',
    activity: '#059669',
    training: '#EA580C',
  },
};

/** Espacements (multiples de 4). */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Typographie : tailles de base, multipliées par le réglage d'accessibilité du système. */
export const typography = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  subtitle: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: '800' as const },
  display: { fontSize: 44, lineHeight: 52, fontWeight: '800' as const },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Taille minimale d'une zone tactile (accessibilité). */
export const MIN_TOUCH = 44;

/** Largeur à partir de laquelle on affiche la mise en page "ordinateur" (barre latérale). */
export const DESKTOP_BREAKPOINT = 900;

export type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  nutrition: NutritionColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

export function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: colors[scheme],
    nutrition: nutritionColors[scheme],
    spacing,
    radius,
    typography,
  };
}

/** Viseur caméra (scan) : fixe quel que soit le thème, car posé sur l'image de la caméra. */
export const cameraColors = { background: '#000000', frame: '#FFFFFF' } as const;
