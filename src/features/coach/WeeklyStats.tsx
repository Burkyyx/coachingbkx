import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import {
  Card,
  HStack,
  SectionHeader,
  StatTile,
  Text,
  VStack,
  type IconName,
} from '@/components/ui';
import { formatNumber, formatShortDate } from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

import type { WeeklyStats } from './api';

/** Quatre chiffres clés de la semaine en cours, comparés à la semaine précédente. */
export function WeekTiles({
  stats,
  adherentCount,
}: {
  stats: WeeklyStats[];
  adherentCount: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const current = stats[stats.length - 1];
  const previous = stats[stats.length - 2];
  if (!current) return null;
  const prev = (v: number | undefined, total?: number) =>
    t('coach.week.previous', {
      value: v === undefined ? '—' : total !== undefined ? `${v} / ${total}` : String(v),
    });

  return (
    <VStack gap="sm">
      <SectionHeader title={t('coach.week.title')} icon="calendar" accent={theme.accent.program} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Tile
          label={t('coach.week.activeAdherents')}
          value={current.active_adherents}
          of={t('coach.week.activeOf', { count: adherentCount })}
          previous={prev(previous?.active_adherents)}
          icon="people"
          color={theme.accent.people}
        />
        <Tile
          label={t('coach.week.sessions')}
          value={current.sessions_done}
          of={t('coach.week.plannedOf', { count: current.sessions_planned })}
          previous={prev(previous?.sessions_done, previous?.sessions_planned)}
          icon="barbell"
          color={theme.accent.training}
        />
        <Tile
          label={t('coach.week.records')}
          value={current.records}
          previous={prev(previous?.records)}
          icon="trophy"
          color={theme.accent.records}
        />
        <Tile
          label={t('coach.week.checkins')}
          value={current.checkins_received}
          of={t('coach.week.expectedOf', { count: current.checkins_expected })}
          previous={prev(previous?.checkins_received, previous?.checkins_expected)}
          icon="clipboard"
          color={theme.accent.checkins}
        />
      </View>
    </VStack>
  );
}

function Tile({
  label,
  value,
  of,
  previous,
  icon,
  color,
}: {
  label: string;
  value: number;
  of?: string;
  previous: string;
  icon: IconName;
  color: string;
}) {
  return (
    <StatTile
      icon={icon}
      color={color}
      label={label}
      value={String(value)}
      unit={of}
      caption={previous}
      emphasis
    />
  );
}

/** Barres « réalisées » et « prévues » par semaine, avec le taux global sur la période. */
export function AttendanceChart({ stats }: { stats: WeeklyStats[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const planned = stats.reduce((n, s) => n + s.sessions_planned, 0);
  const done = stats.reduce((n, s) => n + s.sessions_done, 0);
  const max = Math.max(4, ...stats.map((s) => Math.max(s.sessions_planned, s.sessions_done)));
  const SECTIONS = 4;
  const maxValue = Math.ceil(max / SECTIONS) * SECTIONS;

  // Deux barres par semaine (réalisées puis prévues), un espace entre les semaines.
  const usable = Math.max(0, width - 60);
  const groupWidth = stats.length ? usable / stats.length : 0;
  const barWidth = Math.max(6, Math.min(22, (groupWidth - 12) / 2));
  const gap = Math.max(4, groupWidth - barWidth * 2 - 2);
  const data = stats.flatMap((s, i) => [
    {
      value: s.sessions_done,
      frontColor: theme.accent.training,
      spacing: 2,
      label: formatShortDate(s.week_start),
      labelWidth: barWidth * 2 + 2 + gap,
      labelTextStyle: {
        color: i === stats.length - 1 ? theme.colors.text : theme.colors.textSubtle,
        fontSize: 10,
      },
      accessibilityLabel: `${s.sessions_done}`,
    },
    {
      value: s.sessions_planned,
      frontColor: theme.colors.border,
      spacing: gap,
    },
  ]);

  return (
    <Card>
      <View
        style={{ gap: theme.spacing.sm }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <HStack justify="space-between" wrap align="flex-start">
          <VStack gap="xxs" flex={1}>
            <Text weight="700">{t('coach.week.attendanceTitle')}</Text>
            <Text variant="small" color="textMuted">
              {t('coach.week.attendanceHelp')}
            </Text>
          </VStack>
          {planned > 0 ? (
            <VStack gap="xxs" align="flex-end">
              <Text variant="title" tabular>
                {formatNumber((done / planned) * 100, 0)} %
              </Text>
              <Text variant="caption" color="textSubtle">
                {t('coach.week.rate')}
              </Text>
            </VStack>
          ) : null}
        </HStack>
        {width > 0 ? (
          <BarChart
            data={data}
            height={180}
            width={usable}
            barWidth={barWidth}
            initialSpacing={8}
            endSpacing={4}
            noOfSections={SECTIONS}
            maxValue={maxValue}
            barBorderTopLeftRadius={3}
            barBorderTopRightRadius={3}
            yAxisTextStyle={{ color: theme.colors.textSubtle, fontSize: 11 }}
            yAxisLabelWidth={32}
            rulesColor={theme.colors.border}
            yAxisColor={theme.colors.border}
            xAxisColor={theme.colors.border}
            disableScroll
            isAnimated={false}
          />
        ) : null}
        <HStack gap="lg">
          <Legend color={theme.accent.training} label={t('coach.week.done')} />
          <Legend color={theme.colors.border} label={t('coach.week.planned')} />
        </HStack>
      </View>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <HStack gap="xs">
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text variant="small" color="textMuted">
        {label}
      </Text>
    </HStack>
  );
}
