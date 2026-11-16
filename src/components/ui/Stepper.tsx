import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  /** Nombre de décimales affichées. */
  decimals?: number;
  unit?: string;
  /** Très gros boutons pour le mode séance. */
  large?: boolean;
};

function format(value: number | null, decimals: number): string {
  if (value === null || Number.isNaN(value)) return '';
  const rounded = Number(value.toFixed(decimals));
  return String(rounded).replace('.', ',');
}

/**
 * Sélecteur numérique − / + avec saisie directe.
 * Accepte la virgule comme séparateur décimal (habitude française).
 */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min = 0,
  max = 9999,
  decimals = 0,
  unit,
  large = false,
}: Props) {
  const theme = useTheme();
  // Texte en cours de saisie (null = on affiche simplement la valeur).
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? format(value, decimals);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const bump = (delta: number) => {
    const base = value ?? 0;
    onChange(clamp(Number((base + delta).toFixed(Math.max(decimals, 2)))));
  };

  const size = large ? 64 : 44;
  const button = (delta: number, icon: 'remove' | 'add') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'add' ? 'Augmenter' : 'Diminuer'} ${label}`}
      onPress={() => bump(delta)}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={large ? 30 : 22} />
    </Pressable>
  );

  return (
    <View style={{ gap: theme.spacing.xs, flex: 1 }}>
      <Text variant="caption" color="textMuted" align="center">
        {label}
        {unit ? ` (${unit})` : ''}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
        {button(-step, 'remove')}
        <TextInput
          accessibilityLabel={label}
          value={text}
          onChangeText={setDraft}
          onFocus={() => setDraft(format(value, decimals))}
          onBlur={() => {
            const n = Number(text.replace(',', '.'));
            if (text.trim() === '') onChange(null);
            else if (!Number.isNaN(n)) onChange(clamp(n));
            setDraft(null);
          }}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={[
            large ? theme.typography.headline : theme.typography.subtitle,
            {
              flex: 1,
              minWidth: 56,
              height: size,
              textAlign: 'center',
              color: theme.colors.text,
              fontVariant: ['tabular-nums'],
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
          ]}
        />
        {button(step, 'add')}
      </View>
    </View>
  );
}
