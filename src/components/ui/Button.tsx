import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg' | 'xl';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
};

const HEIGHTS: Record<ButtonSize, number> = { md: MIN_TOUCH, lg: 52, xl: 64 };

/** Bouton standard. Taille minimale 44 px (accessibilité). */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const palette = {
    primary: { bg: c.primary, fg: 'onPrimary' as const, border: c.primary },
    secondary: { bg: c.surfaceAlt, fg: 'text' as const, border: c.border },
    ghost: { bg: 'transparent', fg: 'text' as const, border: 'transparent' },
    danger: { bg: 'transparent', fg: 'danger' as const, border: c.danger },
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          minHeight: HEIGHTS[size],
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: size === 'md' ? theme.spacing.lg : theme.spacing.xl,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.8 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={c[palette.fg]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} color={palette.fg} size={size === 'xl' ? 26 : 20} /> : null}
          <Text
            variant={size === 'xl' ? 'subtitle' : 'body'}
            weight="700"
            color={palette.fg}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
