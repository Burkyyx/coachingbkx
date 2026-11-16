import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useIsDesktop } from '@/components/AppNav';
import { Badge, Card, HStack, Icon, Text, VStack } from '@/components/ui';
import {
  adherenceRate,
  formatFrenchDate,
  formatRelative,
  formatSigned,
  trendDelta,
  weightTrend,
  type WeightPoint,
} from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

import { fullName, type Overview } from './api';

function AdherenceBar({ rate }: { rate: number | null }) {
  const theme = useTheme();
  if (rate === null) return <Text color="textSubtle">—</Text>;
  const color =
    rate >= 80 ? theme.colors.success : rate >= 50 ? theme.colors.warning : theme.colors.danger;
  return (
    <HStack gap="xs">
      <View
        style={{ width: 60, height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceAlt }}
      >
        <View style={{ width: `${rate}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
      <Text variant="small" tabular>
        {rate} %
      </Text>
    </HStack>
  );
}

function weightDelta(row: Overview): number | null {
  const points = (Array.isArray(row.recent_weights) ? row.recent_weights : []) as unknown as {
    date: string;
    kg: number;
  }[];
  return trendDelta(
    weightTrend(points.map((p): WeightPoint => ({ date: p.date, kg: Number(p.kg) }))),
  );
}

/** Tableau des adhérents (tableau large sur ordinateur, cartes sur mobile). */
export function AdherentTable({ rows }: { rows: Overview[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const desktop = useIsDesktop();

  const open = (id: string) => router.push(`/coach/adherents/${id}`);

  if (!desktop) {
    return (
      <VStack gap="sm">
        {rows.map((r) => {
          const rate = adherenceRate(r.sessions_planned_28d, r.sessions_done_28d);
          const delta = weightDelta(r);
          return (
            <Card
              key={r.adherent_id}
              onPress={() => open(r.adherent_id)}
              accessibilityLabel={fullName(r)}
            >
              <VStack gap="xs">
                <HStack justify="space-between">
                  <Text weight="700">{fullName(r)}</Text>
                  {!r.is_active ? <Badge label={t('coach.inactive')} /> : null}
                  {r.pending_suggestions > 0 ? (
                    <Badge tone="info" icon="sparkles" label={String(r.pending_suggestions)} />
                  ) : null}
                </HStack>
                <Text variant="small" color="textMuted">
                  {t('coach.columns.lastSession')} :{' '}
                  {r.last_session_at ? formatRelative(r.last_session_at) : t('coach.never')}
                  {delta !== null ? ` · ${formatSigned(delta, 1)} kg` : ''}
                </Text>
                <AdherenceBar rate={rate} />
              </VStack>
            </Card>
          );
        })}
      </VStack>
    );
  }

  const head = (label: string, flex: number) => (
    <Text variant="caption" weight="700" color="textSubtle" style={{ flex }}>
      {label.toUpperCase()}
    </Text>
  );
  return (
    <Card padded={false}>
      <HStack
        style={{
          padding: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        }}
      >
        {head(t('coach.columns.name'), 2)}
        {head(t('coach.columns.program'), 2)}
        {head(t('coach.columns.lastSession'), 1.4)}
        {head(t('coach.columns.adherence'), 1.4)}
        {head(t('coach.columns.weight'), 1.1)}
        {head(t('coach.columns.suggestions'), 1)}
        {head(t('coach.columns.checkin'), 1.2)}
      </HStack>
      {rows.map((r, i) => {
        const rate = adherenceRate(r.sessions_planned_28d, r.sessions_done_28d);
        const delta = weightDelta(r);
        return (
          <Pressable
            key={r.adherent_id}
            accessibilityRole="link"
            accessibilityLabel={fullName(r)}
            onPress={() => open(r.adherent_id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.surfaceAlt : 'transparent',
              opacity: r.is_active ? 1 : 0.55,
            })}
          >
            <View style={{ flex: 2, gap: 2 }}>
              <Text weight="700">{fullName(r)}</Text>
              {!r.is_active ? (
                <Text variant="caption" color="textSubtle">
                  {t('coach.inactive')}
                </Text>
              ) : !r.onboarded ? (
                <Text variant="caption" color="textSubtle">
                  {t('coach.notOnboarded')}
                </Text>
              ) : r.goal ? (
                <Text variant="caption" color="textSubtle">
                  {t(`enums.goal.${r.goal}`)}
                </Text>
              ) : null}
            </View>
            <Text
              style={{ flex: 2 }}
              numberOfLines={1}
              color={r.active_program_name ? 'text' : 'textSubtle'}
            >
              {r.active_program_name ?? '—'}
            </Text>
            <Text style={{ flex: 1.4 }} color="textMuted">
              {r.last_session_at ? formatRelative(r.last_session_at) : t('coach.never')}
            </Text>
            <View style={{ flex: 1.4 }}>
              <AdherenceBar rate={rate} />
            </View>
            <HStack gap="xxs" style={{ flex: 1.1 }}>
              {delta !== null ? (
                <>
                  <Icon
                    name={delta > 0.2 ? 'trending-up' : delta < -0.2 ? 'trending-down' : 'remove'}
                    size={16}
                    color="textMuted"
                  />
                  <Text variant="small" tabular>
                    {formatSigned(delta, 1)} kg
                  </Text>
                </>
              ) : (
                <Text color="textSubtle">—</Text>
              )}
            </HStack>
            <View style={{ flex: 1 }}>
              {r.pending_suggestions > 0 ? (
                <Badge tone="info" icon="sparkles" label={String(r.pending_suggestions)} />
              ) : (
                <Text color="textSubtle">—</Text>
              )}
            </View>
            <Text style={{ flex: 1.2 }} color="textMuted">
              {r.last_checkin_week ? formatFrenchDate(r.last_checkin_week) : '—'}
            </Text>
          </Pressable>
        );
      })}
    </Card>
  );
}
