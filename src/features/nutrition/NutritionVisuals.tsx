import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HStack, Icon, Text, VStack, type IconName } from '@/components/ui';
import { formatInt, formatNumber } from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

/** Pastille ronde colorée avec une icône. */
export function IconBadge({
  icon,
  color,
  size = 36,
}: {
  icon: IconName;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}26`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.55} rawColor={color} />
    </View>
  );
}

/** Grand chiffre clé avec icône colorée. */
export function StatTile({
  icon,
  color,
  label,
  value,
  unit,
  caption,
  emphasis,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  emphasis?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 170,
        minWidth: 150,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: emphasis ? `${color}1A` : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: emphasis ? color : theme.colors.border,
        gap: theme.spacing.xs,
      }}
    >
      <HStack gap="sm">
        <IconBadge icon={icon} color={color} size={30} />
        <Text variant="small" color="textMuted" style={{ flex: 1 }}>
          {label}
        </Text>
      </HStack>
      <HStack gap="xs" align="flex-end">
        <Text variant="headline" tabular>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" color="textMuted" style={{ marginBottom: 6 }}>
            {unit}
          </Text>
        ) : null}
      </HStack>
      {caption ? (
        <Text variant="caption" color="textSubtle">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

type Segment = {
  key: string;
  label: string;
  detail?: string;
  value: number;
  color: string;
  icon: IconName;
};

/** Barre empilée : chaque segment proportionnel à sa valeur, légende détaillée dessous. */
export function StackedBar({ segments, unit }: { segments: Segment[]; unit: string }) {
  const theme = useTheme();
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return (
    <VStack gap="sm">
      <View
        style={{
          flexDirection: 'row',
          height: 18,
          borderRadius: 9,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceAlt,
          gap: 2,
        }}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <View key={s.key} style={{ flex: s.value / total, backgroundColor: s.color }} />
          ))}
      </View>
      <VStack gap="xs">
        {segments.map((s) => (
          <HStack key={s.key} gap="sm">
            <IconBadge icon={s.icon} color={s.color} size={26} />
            <VStack gap="xxs" flex={1}>
              <Text variant="small">{s.label}</Text>
              {s.detail ? (
                <Text variant="caption" color="textSubtle">
                  {s.detail}
                </Text>
              ) : null}
            </VStack>
            <Text variant="small" weight="700" tabular>
              {formatInt(s.value)} {unit}
            </Text>
            <Text
              variant="caption"
              color="textSubtle"
              tabular
              style={{ width: 40, textAlign: 'right' }}
            >
              {formatNumber((Math.max(0, s.value) / total) * 100, 0)} %
            </Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

/** Répartition des macros : barre par part de calories + 3 cartes (g, g/kg, %). */
export function MacroBreakdown({
  proteinG,
  carbsG,
  fatG,
  weightKg,
  compact,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
  weightKg: number | null;
  /** Barre + légende sur une ligne, sans les cartes. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = [
    {
      key: 'protein',
      label: t('nutrition.proteinShort'),
      g: proteinG,
      kcal: proteinG * 4,
      color: theme.nutrition.protein,
    },
    {
      key: 'carbs',
      label: t('nutrition.carbsShort'),
      g: carbsG,
      kcal: carbsG * 4,
      color: theme.nutrition.carbs,
    },
    {
      key: 'fat',
      label: t('nutrition.fatShort'),
      g: fatG,
      kcal: fatG * 9,
      color: theme.nutrition.fat,
    },
  ];
  const total = items.reduce((s, x) => s + x.kcal, 0) || 1;
  return (
    <VStack gap="sm">
      <View
        style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}
      >
        {items.map((m) => (
          <View
            key={m.key}
            style={{ flex: Math.max(m.kcal, 1) / total, backgroundColor: m.color }}
          />
        ))}
      </View>
      {compact ? (
        <HStack gap="md" wrap>
          {items.map((m) => (
            <HStack key={m.key} gap="xs">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.color }} />
              <Text variant="caption" color="textMuted">
                {m.label} {formatNumber((m.kcal / total) * 100, 0)} %
                {weightKg ? ` · ${formatNumber(m.g / weightKg, 1)} g/kg` : ''}
              </Text>
            </HStack>
          ))}
        </HStack>
      ) : null}
      <View
        style={{
          display: compact ? 'none' : 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {items.map((m) => (
          <View
            key={m.key}
            style={{
              flexGrow: 1,
              flexBasis: 120,
              padding: theme.spacing.md,
              borderRadius: theme.radius.md,
              backgroundColor: `${m.color}1A`,
              borderLeftWidth: 4,
              borderLeftColor: m.color,
              gap: 2,
            }}
          >
            <Text variant="small" color="textMuted">
              {m.label}
            </Text>
            <HStack gap="xs" align="flex-end">
              <Text variant="title" tabular>
                {formatInt(m.g)}
              </Text>
              <Text variant="small" color="textMuted" style={{ marginBottom: 3 }}>
                g
              </Text>
            </HStack>
            <Text variant="caption" color="textSubtle">
              {weightKg ? `${formatNumber(m.g / weightKg, 1)} g/kg · ` : ''}
              {formatNumber((m.kcal / total) * 100, 0)} % des kcal
            </Text>
          </View>
        ))}
      </View>
    </VStack>
  );
}
