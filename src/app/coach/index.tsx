import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useIsDesktop } from '@/components/AppNav';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  HStack,
  LoadingState,
  Screen,
  SectionHeader,
  Segmented,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatRelative } from '@/core';
import { AdherentTable } from '@/features/coach/AdherentTable';
import {
  coachKeys,
  fullName,
  runAnalysis,
  useAlerts,
  useMarkAlertsSeen,
  useOverview,
  useWeeklyStats,
} from '@/features/coach/api';
import { AttendanceChart, WeekTiles } from '@/features/coach/WeeklyStats';
import type { Enums } from '@/lib/supabase';
import { toUserMessage } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

type AlertType = Enums<'alert_type'>;

/** Tableau de bord du coach : chiffres de la semaine, assiduité, alertes, suggestions, adhérents. */
export default function CoachDashboard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const desktop = useIsDesktop();
  const { toast } = useFeedback();
  const overview = useOverview();
  const alerts = useAlerts();
  const weekly = useWeeklyStats();
  const qc = useQueryClient();
  const markSeen = useMarkAlertsSeen();
  const [analyzing, setAnalyzing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [alertType, setAlertType] = useState<AlertType | 'all'>('all');

  if (overview.isLoading) return <LoadingState />;
  if (overview.isError) {
    return (
      <Screen>
        <ErrorState onRetry={() => void overview.refetch()} />
      </Screen>
    );
  }
  const rows = overview.data ?? [];
  const pending = rows.reduce((n, r) => n + r.pending_suggestions, 0);
  const allAlerts = alerts.data ?? [];
  // Filtre par type : on ne propose que les types présents, avec leur nombre.
  const alertCounts = new Map<AlertType, number>();
  for (const a of allAlerts) alertCounts.set(a.type, (alertCounts.get(a.type) ?? 0) + 1);
  const activeType = alertType !== 'all' && alertCounts.has(alertType) ? alertType : 'all';
  const alertList =
    activeType === 'all' ? allAlerts : allAlerts.filter((a) => a.type === activeType);
  const alertOptions = [
    { value: 'all' as const, label: `${t('coach.allAlerts')} (${allAlerts.length})` },
    ...[...alertCounts.entries()].map(([type, count]) => ({
      value: type,
      label: `${t(`coach.alertTypes.${type}`)} (${count})`,
    })),
  ];
  const refreshAll = () => {
    void overview.refetch();
    void alerts.refetch();
    void qc.invalidateQueries({ queryKey: coachKeys.weeklyStats });
  };

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const count = await runAnalysis();
      toast(t('coach.analyzed', { count }));
      refreshAll();
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Screen maxWidth={1400} onRefresh={refreshAll} refreshing={overview.isRefetching}>
      <HStack justify="space-between" wrap>
        <VStack gap="xxs">
          <Text variant="headline" accessibilityRole="header">
            {t('nav.dashboard')}
          </Text>
          <Text color="textMuted">{t('coach.dashboardSubtitle')}</Text>
        </VStack>
        <Button
          variant="secondary"
          icon="sparkles-outline"
          label={t('coach.analyzeNow')}
          loading={analyzing}
          onPress={() => void analyze()}
        />
      </HStack>

      {weekly.data && weekly.data.length > 0 ? (
        <WeekTiles
          stats={weekly.data}
          adherentCount={rows.filter((r) => r.is_active && r.onboarded).length}
        />
      ) : null}

      <View
        style={{
          flexDirection: desktop ? 'row' : 'column',
          alignItems: 'stretch',
          gap: theme.spacing.lg,
        }}
      >
        {weekly.data && weekly.data.length > 0 ? (
          <View style={{ flex: 2 }}>
            <AttendanceChart stats={weekly.data} />
          </View>
        ) : null}

        {/* Suggestions */}
        <Card style={{ flex: 1, minWidth: 240 }}>
          <VStack gap="md">
            <Text variant="subtitle">{t('nav.suggestions')}</Text>
            <Text variant="headline" tabular>
              {pending}
            </Text>
            <Text color="textMuted">{t('coach.pendingSuggestions', { count: pending })}</Text>
            <Button
              icon="sparkles"
              label={t('coach.review')}
              disabled={pending === 0}
              onPress={() => router.push('/coach/suggestions')}
            />
          </VStack>
        </Card>
      </View>

      {/* Alertes */}
      <Card>
        <VStack gap="sm">
          <SectionHeader
            title={`${t('coach.alerts')} (${allAlerts.length})`}
            right={
              alertList.length > 0 ? (
                <Button
                  variant="ghost"
                  label={t('coach.markAllSeen')}
                  onPress={() => markSeen.mutate(alertList.map((a) => a.id))}
                />
              ) : null
            }
          />
          {alertCounts.size > 1 ? (
            <Segmented
              scrollable
              options={alertOptions}
              value={activeType}
              onChange={(v) => {
                setAlertType(v);
                setShowAll(false);
              }}
            />
          ) : null}
          {alertList.length === 0 ? (
            <Text color="textMuted">
              {activeType === 'all' ? t('coach.noAlerts') : t('coach.noAlertsOfType')}
            </Text>
          ) : (
            alertList.slice(0, showAll ? 50 : 6).map((a) => (
              <HStack key={a.id} gap="sm" align="flex-start" style={{ paddingVertical: 4 }}>
                <Badge
                  label={t(`coach.alertTypes.${a.type}`)}
                  tone={
                    a.type === 'new_record'
                      ? 'highlight'
                      : a.type === 'high_fatigue' || a.type === 'inactive'
                        ? 'danger'
                        : 'warning'
                  }
                />
                <VStack gap="xxs" flex={1}>
                  <Text
                    variant="small"
                    onPress={() => router.push(`/coach/adherents/${a.adherent_id}`)}
                  >
                    {a.message}
                  </Text>
                  <Text variant="caption" color="textSubtle">
                    {a.adherent ? fullName(a.adherent) : ''} · {formatRelative(a.created_at)}
                  </Text>
                </VStack>
                <Button
                  variant="ghost"
                  label={t('coach.markSeen')}
                  onPress={() => markSeen.mutate([a.id])}
                />
              </HStack>
            ))
          )}
          {alertList.length > 6 ? (
            <Button
              variant="ghost"
              label={
                showAll
                  ? t('coach.showLessAlerts')
                  : t('coach.showMoreAlerts', { count: alertList.length })
              }
              onPress={() => setShowAll((v) => !v)}
            />
          ) : null}
        </VStack>
      </Card>

      <SectionHeader title={`${t('coach.adherents')} (${rows.length})`} />
      {rows.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={t('coach.noAdherents')}
          actionLabel={t('coach.inviteFirst')}
          onAction={() => router.push('/coach/invitations')}
        />
      ) : (
        <AdherentTable rows={rows} />
      )}
    </Screen>
  );
}
