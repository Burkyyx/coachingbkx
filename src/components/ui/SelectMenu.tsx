import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Props<T extends string | number> = {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  compact?: boolean;
  placeholder?: string;
};

/** Liste déroulante (ouvre une petite fenêtre de choix). */
export function SelectMenu<T extends string | number>({
  label,
  value,
  options,
  onChange,
  compact,
  placeholder = '—',
}: Props<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${current?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          minHeight: compact ? 36 : MIN_TOUCH,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceAlt,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text variant={compact ? 'small' : 'body'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {current?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={14} color="textMuted" />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} maxWidth={420}>
        <View style={{ gap: 2 }}>
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <Pressable
                key={String(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: MIN_TOUCH,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  backgroundColor: selected || pressed ? theme.colors.surfaceAlt : 'transparent',
                })}
              >
                <Text weight={selected ? '700' : '400'} style={{ flex: 1 }}>
                  {opt.label}
                </Text>
                {selected ? <Icon name="checkmark" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
}
