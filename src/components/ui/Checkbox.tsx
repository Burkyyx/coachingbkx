import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
};

/** Case à cocher accessible avec libellé et description. */
export function Checkbox({ checked, onChange, label, description, disabled }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.md,
        alignItems: 'flex-start',
        minHeight: MIN_TOUCH,
        opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
      })}
    >
      <View
        style={{
          width: 26,
          height: 26,
          marginTop: 2,
          borderRadius: theme.radius.sm,
          borderWidth: 2,
          borderColor: checked ? theme.colors.primary : theme.colors.textMuted,
          backgroundColor: checked ? theme.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <Icon name="checkmark" size={18} color="onPrimary" /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="600">{label}</Text>
        {typeof description === 'string' ? (
          <Text variant="small" color="textMuted">
            {description}
          </Text>
        ) : (
          description
        )}
      </View>
    </Pressable>
  );
}
