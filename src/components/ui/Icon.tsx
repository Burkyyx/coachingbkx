import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: Exclude<keyof ThemeColors, 'chart'>;
  /** Couleur brute (prioritaire sur `color`). */
  rawColor?: string;
};

/** Icônes Ionicons, colorées selon le thème. */
export function Icon({ name, size = 22, color = 'text', rawColor }: Props) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={rawColor ?? theme.colors[color]} />;
}
