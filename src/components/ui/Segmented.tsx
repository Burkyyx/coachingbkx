import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { DESKTOP_BREAKPOINT, MIN_TOUCH } from '@/theme/tokens';

import { Text } from './Text';

export type SegmentOption<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  options: readonly SegmentOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  /** Défilement horizontal sur mobile quand il y a beaucoup d'options (retour à la ligne sur ordinateur). */
  scrollable?: boolean;
};

/** Choix unique parmi quelques options (pastilles). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  scrollable = false,
}: Props<T>) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const items = options.map((opt) => {
    const selected = opt.value === value;
    return (
      <Pressable
        key={String(opt.value)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={opt.label}
        onPress={() => onChange(opt.value)}
        style={({ pressed }) => ({
          minHeight: MIN_TOUCH,
          minWidth: MIN_TOUCH,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Text weight="600" color={selected ? 'onPrimary' : 'text'} variant="small">
          {opt.label}
        </Text>
      </Pressable>
    );
  });

  // Sur ordinateur, les pastilles passent à la ligne (plus pratique à la souris).
  if (scrollable && width < DESKTOP_BREAKPOINT) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        // Hauteur fixe : sans cela, une liste placée en dessous « écrase » la rangée.
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2, alignItems: 'center' }}
      >
        {items}
      </ScrollView>
    );
  }
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
    >
      {items}
    </View>
  );
}
