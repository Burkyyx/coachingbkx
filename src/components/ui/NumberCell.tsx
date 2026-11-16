import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type Props = {
  label: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  width?: number;
  decimals?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  /** Affiche le libellé au-dessus (mobile) ; sinon libellé uniquement pour l'accessibilité. */
  showLabel?: boolean;
};

function format(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/**
 * Petite case numérique pour les tableaux (séries prescrites).
 * La valeur est enregistrée à la sortie du champ (ou avec Entrée).
 */
export function NumberCell({
  label,
  value,
  onCommit,
  width = 64,
  decimals = 2,
  min = 0,
  max = 9999,
  placeholder = '—',
  showLabel = false,
}: Props) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim().replace(',', '.');
    setDraft(null);
    if (trimmed === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) return;
    const factor = 10 ** decimals;
    const clamped = Math.min(max, Math.max(min, Math.round(n * factor) / factor));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <View style={{ width, gap: 2 }}>
      {showLabel ? (
        <Text variant="caption" color="textSubtle" numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        value={draft ?? format(value)}
        onFocus={() => setDraft(format(value))}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSubtle}
        style={[
          theme.typography.small,
          {
            height: 36,
            textAlign: 'center',
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
            fontVariant: ['tabular-nums'],
          },
        ]}
      />
    </View>
  );
}
