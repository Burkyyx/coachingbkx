import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Segmented,
  Text,
  VStack,
} from '@/components/ui';
import { formatFrenchDate } from '@/core';
import { useAdherentProfile } from '@/features/coach/adherent';
import {
  CheckinsTab,
  NotesTab,
  ProfileTab,
  ProgressTab,
  RecordsTab,
  SessionsTab,
  SettingsTab,
} from '@/features/coach/AdherentTabs';
import { fullName } from '@/features/coach/api';
import { useConfirmDeleteAdherent } from '@/features/coach/useConfirmDeleteAdherent';
import { NutritionTargetsTab } from '@/features/nutrition/NutritionTargetsTab';

type Tab =
  'profile' | 'sessions' | 'progress' | 'records' | 'checkins' | 'nutrition' | 'notes' | 'settings';
const TABS: Tab[] = [
  'profile',
  'sessions',
  'progress',
  'records',
  'checkins',
  'nutrition',
  'notes',
  'settings',
];

/** Fiche adhérent : tout ce que fait l'adhérent, et les réglages du coach. */
export default function AdherentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const deleteAdherent = useConfirmDeleteAdherent();
  const profile = useAdherentProfile(id);
  const [tab, setTab] = useState<Tab>('profile');

  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  const p = profile.data;

  return (
    <Screen maxWidth={1100}>
      <Button
        variant="ghost"
        icon="arrow-back"
        label={t('nav.adherents')}
        onPress={() => router.navigate('/coach/adherents')}
        style={{ alignSelf: 'flex-start' }}
      />
      <HStack justify="space-between" wrap>
        <HStack gap="md">
          <Avatar id={p.id} name={fullName(p)} size={52} />
          <VStack gap="xxs">
            <HStack gap="sm">
              <Text variant="headline" accessibilityRole="header">
                {fullName(p)}
              </Text>
              {!p.is_active ? <Badge label={t('coach.inactive')} tone="warning" /> : null}
            </HStack>
            <Text color="textMuted">
              {p.nickname ? `@${p.nickname} · ` : ''}
              {t('adherent.memberSince', { date: formatFrenchDate(p.created_at.slice(0, 10)) })}
            </Text>
          </VStack>
        </HStack>
        <HStack gap="xs">
          <Button
            variant="secondary"
            icon="chatbubble-outline"
            label={t('adherent.sendMessage')}
            onPress={() => router.push(`/coach/messages/${p.id}`)}
          />
          <IconButton
            icon="trash-outline"
            label={t('adherent.deleteAdherent')}
            color="danger"
            disabled={deleteAdherent.pending}
            onPress={() =>
              void deleteAdherent.run(p.id, fullName(p), () => router.replace('/coach/adherents'))
            }
          />
        </HStack>
      </HStack>
      <Segmented
        scrollable
        options={TABS.map((x) => ({ value: x, label: t(`adherent.tabs.${x}`) }))}
        value={tab}
        onChange={setTab}
      />
      {tab === 'profile' ? <ProfileTab profile={p} /> : null}
      {tab === 'sessions' ? <SessionsTab adherentId={p.id} /> : null}
      {tab === 'progress' ? <ProgressTab adherentId={p.id} /> : null}
      {tab === 'records' ? <RecordsTab adherentId={p.id} /> : null}
      {tab === 'checkins' ? <CheckinsTab adherentId={p.id} /> : null}
      {tab === 'nutrition' ? <NutritionTargetsTab profile={p} /> : null}
      {tab === 'notes' ? <NotesTab adherentId={p.id} /> : null}
      {tab === 'settings' ? <SettingsTab profile={p} /> : null}
    </Screen>
  );
}
