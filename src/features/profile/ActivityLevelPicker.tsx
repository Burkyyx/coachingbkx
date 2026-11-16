import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Text, VStack } from '@/components/ui';
import type { Enums } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

export type ActivityLevel = Enums<'activity_level'>;

export const ACTIVITY_LEVELS = [
  'sedentary',
  'lightly_active',
  'moderately_active',
  'very_active',
  'extremely_active',
] as const satisfies readonly ActivityLevel[];

type Props = {
  value: ActivityLevel | null;
  onChange: (value: ActivityLevel) => void;
  disabled?: boolean;
};

/** Choix du niveau d'activité au quotidien : 5 cartes avec une explication chacune. */
export function ActivityLevelPicker({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <VStack gap="xs">
      {ACTIVITY_LEVELS.map((level, index) => {
        const selected = value === level;
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={t(`enums.activity.${level}`)}
            disabled={disabled}
            onPress={() => onChange(level)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              minHeight: MIN_TOUCH,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? theme.colors.text : theme.colors.border,
              backgroundColor: selected ? theme.colors.surfaceAlt : 'transparent',
              opacity: pressed ? 0.7 : disabled ? 0.5 : 1,
            })}
          >
            {/* Jauge 1 à 5 barres : repère visuel du niveau. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, width: 34 }}>
              {ACTIVITY_LEVELS.map((_, bar) => (
                <View
                  key={bar}
                  style={{
                    width: 5,
                    height: 6 + bar * 4,
                    borderRadius: 1,
                    backgroundColor: bar <= index ? theme.colors.text : theme.colors.border,
                  }}
                />
              ))}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="600">{t(`enums.activity.${level}`)}</Text>
              <Text variant="small" color="textMuted">
                {t(`enums.activityHint.${level}`)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </VStack>
  );
}
