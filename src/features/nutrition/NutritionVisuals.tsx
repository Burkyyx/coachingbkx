import { useTranslation } from 'react-i18next';
import type React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { HStack, IconBadge, Text, VStack, type IconName } from '@/components/ui';
import { formatInt, formatNumber } from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

export { IconBadge, StatTile } from '@/components/ui';

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

/** Anneau de progression (calories du jour vs objectif). */
export function ProgressRing({
  progress,
  size = 148,
  stroke = 14,
  color,
  children,
}: {
  /** 0 → 1 (au-delà, l'anneau reste plein). null = pas d'objectif. */
  progress: number | null;
  size?: number;
  stroke?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress ?? 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.surfaceAlt}
          strokeWidth={stroke}
          fill="none"
        />
        {progress !== null && p > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** Barre « consommé / objectif » d'un macronutriment. */
export function MacroProgress({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number | null;
  color: string;
}) {
  const theme = useTheme();
  const p = target && target > 0 ? Math.min(1, value / target) : 0;
  return (
    <VStack gap="xxs" flex={1} style={{ minWidth: 90 }}>
      <HStack gap="xs">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      </HStack>
      <Text variant="small" weight="700" tabular>
        {formatInt(value)}
        {target ? ` / ${formatInt(target)}` : ''} g
      </Text>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{ width: `${p * 100}%`, height: 6, borderRadius: 3, backgroundColor: color }}
        />
      </View>
    </VStack>
  );
}
