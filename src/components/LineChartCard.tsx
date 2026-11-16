import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { useTheme } from '@/theme/ThemeProvider';

import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { formatNumber } from '@/core';

export type ChartPoint = { label: string; value: number };

type Props = {
  title: string;
  points: readonly ChartPoint[];
  /** Deuxième courbe optionnelle (ex. tendance de poids lissée). */
  points2?: readonly ChartPoint[];
  unit?: string;
  height?: number;
  emptyText: string;
};

/**
 * Courbe simple (iOS, Android, web) avec react-native-gifted-charts.
 * L'axe vertical démarre près de la valeur minimale pour bien voir l'évolution.
 */
export function LineChartCard({
  title,
  points,
  points2,
  unit = '',
  height = 180,
  emptyText,
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const values = [...points, ...(points2 ?? [])].map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = Math.max(1, (max - min) * 0.15);
  const offset = Math.max(0, Math.floor(min - pad));
  // Plage arrondie à un multiple du nombre de graduations : libellés entiers et exacts.
  const SECTIONS = 4;
  const range = Math.max(SECTIONS, Math.ceil((max + pad - offset) / SECTIONS) * SECTIONS);
  const step = points.length > 1 ? Math.max(8, (width - 70) / (points.length - 1)) : 40;
  const last = points[points.length - 1];

  return (
    <Card>
      <View
        style={{ gap: theme.spacing.sm }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text weight="700">{title}</Text>
          {last ? (
            <Text weight="700" tabular>
              {formatNumber(last.value, 1)} {unit}
            </Text>
          ) : null}
        </View>
        {points.length < 2 || width === 0 ? (
          <Text color="textMuted">{emptyText}</Text>
        ) : (
          <LineChart
            data={points.map((p, i) => ({
              value: p.value - offset,
              label: i % Math.ceil(points.length / 5) === 0 ? p.label : '',
              dataPointText: undefined,
            }))}
            data2={points2?.map((p) => ({ value: p.value - offset }))}
            height={height}
            width={width - 50}
            spacing={step}
            initialSpacing={6}
            endSpacing={6}
            color1={theme.colors.chart[0]}
            color2={theme.colors.chart[1]}
            dataPointsColor1={theme.colors.chart[0]}
            hideDataPoints2
            thickness={2}
            noOfSections={SECTIONS}
            maxValue={range}
            yAxisLabelSuffix=""
            formatYLabel={(label: string) => formatNumber(Number(label) + offset, 0)}
            yAxisTextStyle={{ color: theme.colors.textSubtle, fontSize: 11 }}
            xAxisLabelTextStyle={{ color: theme.colors.textSubtle, fontSize: 10, width: 60 }}
            rulesColor={theme.colors.border}
            yAxisColor={theme.colors.border}
            xAxisColor={theme.colors.border}
            yAxisLabelWidth={40}
          />
        )}
      </View>
    </Card>
  );
}
