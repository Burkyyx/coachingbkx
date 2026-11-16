import { router } from 'expo-router';
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
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatRelative } from '@/core';
import { AdherentTable } from '@/features/coach/AdherentTable';
import {
  fullName,
  runAnalysis,
  useAlerts,
  useMarkAlertsSeen,
  useOverview,
} from '@/features/coach/api';
import { toUserMessage } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';

/** Tableau de bord du coach : alertes, suggestions en attente, adhérents. */
export default function CoachDashboard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const desktop = useIsDesktop();
  const { toast } = useFeedback();
  const overview = useOverview();
  const alerts = useAlerts();
  const markSeen = useMarkAlertsSeen();
  const [analyzing, setAnalyzing] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
  const alertList = alerts.data ?? [];

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const count = await runAnalysis();
      toast(t('coach.analyzed', { count }));
      void overview.refetch();
      void alerts.refetch();
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Screen
      maxWidth={1400}
      onRefresh={() => {
        void overview.refetch();
        void alerts.refetch();
      }}
      refreshing={overview.isRefetching}
    >
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

      <View
        style={{
          flexDirection: desktop ? 'row' : 'column',
          alignItems: desktop ? 'flex-start' : 'stretch',
          gap: theme.spacing.lg,
        }}
      >
        {/* Alertes */}
        <Card style={{ flex: 2 }}>
          <VStack gap="sm">
            <SectionHeader
              title={`${t('coach.alerts')} (${alertList.length})`}
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
            {alertList.length === 0 ? (
              <Text color="textMuted">{t('coach.noAlerts')}</Text>
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
                label={showAll ? 'Voir moins' : `Voir les ${alertList.length} alertes`}
                onPress={() => setShowAll((v) => !v)}
              />
            ) : null}
          </VStack>
        </Card>

        {/* Suggestions */}
        <Card style={{ flex: 1 }}>
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
