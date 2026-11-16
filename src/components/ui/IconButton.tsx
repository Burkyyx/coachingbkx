import { Pressable, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, type ThemeColors } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

type Props = Omit<PressableProps, 'children'> & {
  icon: IconName;
  /** Libellé lu par les lecteurs d'écran (obligatoire : un bouton icône n'a pas de texte). */
  label: string;
  size?: number;
  color?: Exclude<keyof ThemeColors, 'chart'>;
  filled?: boolean;
};

export function IconButton({
  icon,
  label,
  size = 22,
  color = 'text',
  filled,
  style,
  ...rest
}: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={(state) => [
        {
          minWidth: MIN_TOUCH,
          minHeight: MIN_TOUCH,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          backgroundColor: filled ? theme.colors.surfaceAlt : 'transparent',
          opacity: state.pressed ? 0.6 : rest.disabled ? 0.4 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}
