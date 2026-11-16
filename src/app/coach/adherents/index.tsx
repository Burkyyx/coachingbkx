import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  EmptyState,
  ErrorState,
  HStack,
  LoadingState,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { AdherentTable } from '@/features/coach/AdherentTable';
import { fullName, useOverview } from '@/features/coach/api';
import { normalizeSearch } from '@/features/exercises/api';

/** Liste des adhérents. */
export default function AdherentsScreen() {
  const { t } = useTranslation();
  const overview = useOverview();
  const [search, setSearch] = useState('');
  const rows = useMemo(
    () =>
      (overview.data ?? []).filter((r) =>
        normalizeSearch(fullName(r)).includes(normalizeSearch(search)),
      ),
    [overview.data, search],
  );

  return (
    <Screen
      maxWidth={1400}
      onRefresh={() => void overview.refetch()}
      refreshing={overview.isRefetching}
    >
      <HStack justify="space-between" wrap>
        <Text variant="headline" accessibilityRole="header">
          {t('nav.adherents')}
        </Text>
        <Button
          icon="person-add-outline"
          label={t('coach.inviteFirst')}
          onPress={() => router.push('/coach/invitations')}
        />
      </HStack>
      <TextField
        placeholder={t('coach.searchAdherent')}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel={t('common.search')}
      />
      {overview.isLoading ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState onRetry={() => void overview.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="people-outline" title={t('coach.noAdherents')} />
      ) : (
        <AdherentTable rows={rows} />
      )}
    </Screen>
  );
}
