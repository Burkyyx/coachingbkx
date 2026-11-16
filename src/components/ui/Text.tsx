import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors, TypographyVariant } from '@/theme/tokens';

type ColorKey = Exclude<keyof ThemeColors, 'chart'>;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorKey;
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'left' | 'center' | 'right';
  /** Chiffres à largeur fixe (utile pour les minuteurs et les charges). */
  tabular?: boolean;
};

/**
 * Texte de base de l'app. La taille suit le réglage d'accessibilité du système
 * (allowFontScaling est actif par défaut).
 */
export function Text({
  variant = 'body',
  color = 'text',
  weight,
  align,
  tabular,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
