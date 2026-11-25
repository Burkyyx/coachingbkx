import { Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type Props = ViewProps & {
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Couleur d'accent (liseré à gauche + fond légèrement teinté). */
  accent?: string;
};

/** Carte : conteneur avec fond légèrement contrasté et coins arrondis. */
export function Card({ onPress, padded = true, style, accent, children, ...rest }: Props) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: padded ? theme.spacing.lg : 0,
    ...(accent
      ? {
          borderLeftWidth: 4,
          borderLeftColor: accent,
          borderColor: `${accent}40`,
          backgroundColor: theme.scheme === 'dark' ? `${accent}0F` : `${accent}0A`,
        }
      : null),
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} {...rest}>
      {children}
    </View>
  );
}
