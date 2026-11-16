import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LineChartCard } from '@/components/LineChartCard';
import {
  Button,
  Card,
  Checkbox,
  CommitTextField,
  HStack,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Segmented,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  formatDuration,
  formatFrenchDate,
  formatNumber,
  formatShortDate,
  weightTrend,
} from '@/core';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { CONSENT_VERSION, hasActiveConsent, type ConsentType } from '@/features/auth/consents';
import { saveWeight } from '@/features/checkin/api';
import { ADHERENT_TYPES, isEnabled } from '@/features/notifications/api';
import { deleteMyAccount, exportMyData } from '@/features/profile/export';
import { useAdherentBundle } from '@/features/training/bundle';
import { toUserMessage } from '@/lib/errors';
import { supabase, type TablesUpdate } from '@/lib/supabase';
import { localStore } from '@/offline/store';
import { useSyncStatus } from '@/offline/sync';
import { usePreferences } from '@/stores/preferences';

const CONSENT_TYPES: ConsentType[] = [
  'terms',
  'training_data',
  'health_data',
  'ai_photo',
  'community',
];

/** Onglet « Profil » : infos, pesées, records, historique, réglages, RGPD. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const { profile, userId, consents, refresh } = useAuth();
  const qc = useQueryClient();
  const bundle = useAdherentBundle();
  const pending = useSyncStatus((s) => s.pending);
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const weights = useQuery({
    queryKey: ['my-weights', userId],
    enabled: userId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_weights')
        .select('measured_on, weight_kg')
        .order('measured_on')
        .limit(120);
      if (error) throw error;
      return data;
    },
  });
  const records = useQuery({
    queryKey: ['my-records', userId],
    enabled: userId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*, exercise:exercises(name)')
        .neq('record_type', 'session_volume')
        .order('achieved_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });
  const updateProfile = useMutation({
    mutationFn: async (patch: TablesUpdate<'profiles'>) => {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId as string);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast(t('profile.saved'));
      await refresh();
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  if (!profile || !userId) return null;
  const prefs = profile.notification_prefs;
  const trend = weightTrend(
    (weights.data ?? []).map((w) => ({ date: w.measured_on, kg: Number(w.weight_kg) })),
  );
  const sessions = (bundle.data?.sessions ?? [])
    .filter((s) => s.status === 'completed')
    .slice()
    .reverse();
  const workoutNames = new Map((bundle.data?.workouts ?? []).map((w) => [w.id, w.name]));

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleConsent = async (type: ConsentType, grant: boolean) => {
    if (!grant) {
      const ok = await confirm({
        title: t('consents.revoke'),
        message: t('consents.revokeConfirm'),
        destructive: true,
        confirmLabel: t('consents.revoke'),
      });
      if (!ok) return;
      await supabase
        .from('consents')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('type', type)
        .is('revoked_at', null);
    } else {
      await supabase.from('consents').insert({ user_id: userId, type, version: CONSENT_VERSION });
    }
    await refresh();
  };

  return (
    <Screen edges={['top']} maxWidth={720}>
      <Text variant="headline" accessibilityRole="header">
        {t('profile.title')}
      </Text>

      <SectionHeader title={t('profile.info')} />
      <Card>
        <VStack gap="md">
          <CommitTextField
            label={t('onboarding.firstName')}
            value={profile.first_name ?? ''}
            onCommit={(v) => updateProfile.mutate({ first_name: v })}
          />
          <CommitTextField
            label={t('onboarding.lastName')}
            value={profile.last_name ?? ''}
            onCommit={(v) => updateProfile.mutate({ last_name: v })}
          />
          <CommitTextField
            label={t('onboarding.nickname')}
            value={profile.nickname ?? ''}
            onCommit={(v) => updateProfile.mutate({ nickname: v || null })}
          />
          <CommitTextField
            label={t('onboarding.injuries')}
            hint={t('onboarding.injuriesHint')}
            value={profile.injuries ?? ''}
            multiline
            onCommit={(v) => updateProfile.mutate({ injuries: v || null })}
          />
        </VStack>
      </Card>

      <SectionHeader title={t('profile.weights')} />
      <Card>
        <HStack gap="sm" align="flex-end">
          <View style={{ flex: 1 }}>
            <TextField
              label={t('profile.weightToday')}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <Button
            icon="add"
            label={t('common.add')}
            disabled={weight.trim() === ''}
            onPress={() =>
              void run('weight', async () => {
                const kg = Number(weight.replace(',', '.'));
                if (Number.isNaN(kg) || kg < 25 || kg > 350) return;
                await saveWeight(userId, kg);
                setWeight('');
                toast(t('profile.weightSaved'));
                setTimeout(
                  () => void qc.invalidateQueries({ queryKey: ['my-weights', userId] }),
                  1500,
                );
              })
            }
          />
        </HStack>
      </Card>
      <LineChartCard
        title={t('adherent.weightTrend')}
        unit="kg"
        points={trend.map((p) => ({ label: formatShortDate(p.date), value: p.kg }))}
        points2={trend.map((p) => ({ label: formatShortDate(p.date), value: p.trend }))}
        emptyText={t('profile.noWeights')}
      />

      <SectionHeader title={t('profile.records')} />
      <Card>
        {(records.data ?? []).length === 0 ? (
          <Text color="textMuted">{t('adherent.noRecords')}</Text>
        ) : null}
        {(records.data ?? []).map((r) => (
          <ListRow
            key={r.id}
            icon="trophy-outline"
            title={(r.exercise as { name: string } | null)?.name ?? '—'}
            subtitle={`${t(`training.recordTypes.${r.record_type}`, {
              value: formatNumber(Number(r.value)),
              load: r.load_kg !== null ? formatNumber(Number(r.load_kg)) : '',
            })} · ${formatFrenchDate(r.achieved_at.slice(0, 10))}`}
          />
        ))}
      </Card>

      <SectionHeader
        title={t('profile.history')}
        right={
          <Text color="textMuted">{t('profile.sessionsCount', { count: sessions.length })}</Text>
        }
      />
      <Card>
        {sessions.slice(0, 10).map((s) => (
          <ListRow
            key={s.id}
            icon="checkmark-circle-outline"
            title={workoutNames.get(s.workout_id ?? '') ?? '—'}
            subtitle={`${formatFrenchDate(s.started_at.slice(0, 10))}${s.duration_seconds ? ` · ${formatDuration(s.duration_seconds)}` : ''}`}
          />
        ))}
        {sessions.length === 0 ? <Text color="textMuted">{t('adherent.noSessions')}</Text> : null}
      </Card>

      <SectionHeader title={t('profile.notifications')} />
      <Card>
        <VStack gap="xs">
          <Text variant="small" color="textMuted">
            {t('profile.notificationsHelp')}
          </Text>
          {ADHERENT_TYPES.map((type) => (
            <Checkbox
              key={type}
              label={t(`notifications.types.${type}`)}
              checked={isEnabled(prefs, type)}
              onChange={(v) =>
                updateProfile.mutate({
                  notification_prefs: { ...((prefs ?? {}) as Record<string, boolean>), [type]: v },
                })
              }
            />
          ))}
        </VStack>
      </Card>

      <SectionHeader title={t('profile.consents')} />
      <Card>
        <VStack gap="sm">
          {CONSENT_TYPES.map((type) => {
            const active = hasActiveConsent(consents, type);
            return (
              <HStack key={type} justify="space-between" wrap>
                <HStack gap="xs" flex={1}>
                  <Icon
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    color={active ? 'success' : 'textSubtle'}
                    size={18}
                  />
                  <Text style={{ flexShrink: 1 }}>{t(`consents.types.${type}.title`)}</Text>
                </HStack>
                <Button
                  variant={active ? 'ghost' : 'secondary'}
                  label={active ? t('consents.revoke') : t('profile.grant')}
                  onPress={() => void toggleConsent(type, !active)}
                />
              </HStack>
            );
          })}
        </VStack>
      </Card>

      <SectionHeader title={t('profile.appearance')} />
      <Segmented
        options={[
          { value: 'dark' as const, label: t('settings.themeDark') },
          { value: 'light' as const, label: t('settings.themeLight') },
          { value: 'system' as const, label: t('settings.themeSystem') },
        ]}
        value={theme}
        onChange={setTheme}
      />

      <SectionHeader title={t('profile.legal')} />
      <Card>
        <ListRow
          icon="document-text-outline"
          title={t('legal.terms')}
          onPress={() => router.push('/legal/terms')}
        />
        <ListRow
          icon="shield-checkmark-outline"
          title={t('legal.privacy')}
          onPress={() => router.push('/legal/privacy')}
        />
        <ListRow
          icon="information-circle-outline"
          title={t('legal.mentions')}
          onPress={() => router.push('/legal/mentions')}
        />
      </Card>
      <Text variant="caption" color="textSubtle">
        {t('legal.disclaimer')}
      </Text>

      <Card>
        <VStack gap="sm">
          <Text weight="700">{t('profile.exportData')}</Text>
          <Text variant="small" color="textMuted">
            {t('profile.exportHelp')}
          </Text>
          <Button
            variant="secondary"
            icon="download-outline"
            label={t('profile.exportData')}
            loading={busy === 'export'}
            onPress={() =>
              void run('export', async () => {
                await exportMyData();
                toast(t('profile.exportDone'));
              })
            }
            style={{ alignSelf: 'flex-start' }}
          />
        </VStack>
      </Card>

      <Button
        variant="secondary"
        icon="log-out-outline"
        label={t('auth.signOut')}
        onPress={async () => {
          if (pending > 0) {
            const ok = await confirm({
              title: t('auth.signOut'),
              message: t('common.offlineBadgeCount', { count: pending }),
              confirmLabel: t('auth.signOut'),
            });
            if (!ok) return;
          }
          await signOut();
        }}
      />

      <Card>
        <VStack gap="sm">
          <Text weight="700" color="danger">
            {t('profile.deleteAccount')}
          </Text>
          <Text variant="small" color="textMuted">
            {t('profile.deleteHelp')}
          </Text>
          <Button
            variant="danger"
            icon="trash-outline"
            label={t('profile.deleteAccount')}
            loading={busy === 'delete'}
            onPress={async () => {
              const first = await confirm({
                title: t('profile.deleteAccount'),
                message: t('profile.deleteConfirm'),
                destructive: true,
                confirmLabel: t('common.continue'),
              });
              if (!first) return;
              const second = await confirm({
                title: t('profile.deleteAccount'),
                message: t('profile.deleteConfirm2'),
                destructive: true,
                confirmLabel: t('common.delete'),
              });
              if (!second) return;
              await run('delete', async () => {
                await deleteMyAccount();
                await localStore.clearAll();
                toast(t('profile.deleted'));
                await signOut();
              });
            }}
            style={{ alignSelf: 'flex-start' }}
          />
        </VStack>
      </Card>
    </Screen>
  );
}
