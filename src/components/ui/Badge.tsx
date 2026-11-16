import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'highlight';

type Props = { label: string; tone?: BadgeTone; icon?: IconName };

/** Petite étiquette colorée (statut, compteur…). */
export function Badge({ label, tone = 'neutral', icon }: Props) {
  const theme = useTheme();
  const color = tone === 'neutral' ? 'textMuted' : tone;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: tone === 'neutral' ? theme.colors.border : theme.colors[tone],
      }}
    >
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <Text variant="caption" weight="600" color={color}>
        {label}
      </Text>
    </View>
  );
}
