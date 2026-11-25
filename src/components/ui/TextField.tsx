import { useState, type ComponentProps } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

import { Text } from './Text';

type Props = TextInputProps & {
  ref?: ComponentProps<typeof TextInput>['ref'];
  label?: string;
  hint?: string;
  error?: string;
};

/** Champ de saisie avec libellé, aide et message d'erreur. */
export function TextField({
  label,
  hint,
  error,
  style,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {label ? (
        <Text variant="small" weight="600" color="textMuted">
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textSubtle}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          theme.typography.body,
          {
            minHeight: multiline ? 96 : MIN_TOUCH + 4,
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceAlt,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: error
              ? theme.colors.danger
              : focused
                ? theme.colors.primary
                : theme.colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: multiline ? theme.spacing.sm : 0,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textSubtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
