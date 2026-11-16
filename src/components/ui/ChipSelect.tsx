import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';
import { Text } from './Text';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  accessibilityLabel?: string;
};

/** Choix multiple sous forme de pastilles. */
export function ChipSelect<T extends string>({
  options,
  values,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
    >
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.label}
            onPress={() =>
              onChange(selected ? values.filter((v) => v !== opt.value) : [...values, opt.value])
            }
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              minHeight: 36,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.pill,
              borderWidth: 1,
              borderColor: selected ? theme.colors.text : theme.colors.border,
              backgroundColor: selected ? theme.colors.surfaceAlt : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {selected ? <Icon name="checkmark" size={14} /> : null}
            <Text
              variant="small"
              weight={selected ? '700' : '500'}
              color={selected ? 'text' : 'textMuted'}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
