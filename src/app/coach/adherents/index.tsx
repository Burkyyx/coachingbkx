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
  SelectMenu,
  Text,
  TextField,
} from '@/components/ui';
import {
  ADHERENT_SORTS,
  AGE_BRACKETS,
  filterAndSortAdherents,
  todayLocal,
  type AdherentSort,
  type AgeBracket,
} from '@/core';
import { AdherentTable } from '@/features/coach/AdherentTable';
import { fullName, useOverview } from '@/features/coach/api';
import { normalizeSearch } from '@/features/exercises/api';
import type { Enums } from '@/lib/supabase';

const SEXES = ['female', 'male', 'other'] as const satisfies readonly Enums<'sex'>[];
const GOALS = [
  'muscle_gain',
  'fat_loss',
  'recomposition',
  'performance',
  'health',
] as const satisfies readonly Enums<'training_goal'>[];

type All = 'all';

/** Liste des adhérents : recherche, filtres (âge, sexe, objectif) et tri. */
export default function AdherentsScreen() {
  const { t } = useTranslation();
  const overview = useOverview();
  const [search, setSearch] = useState('');
  const [age, setAge] = useState<AgeBracket | All>('all');
  const [sex, setSex] = useState<Enums<'sex'> | All>('all');
  const [goal, setGoal] = useState<Enums<'training_goal'> | All>('all');
  const [sort, setSort] = useState<AdherentSort>('name');

  const rows = useMemo(() => {
    const query = normalizeSearch(search);
    const matching = (overview.data ?? []).filter((r) =>
      normalizeSearch(fullName(r)).includes(query),
    );
    return filterAndSortAdherents(
      matching,
      {
        age: age === 'all' ? null : age,
        sex: sex === 'all' ? null : sex,
        goal: goal === 'all' ? null : goal,
      },
      sort,
      todayLocal(),
    );
  }, [overview.data, search, age, sex, goal, sort]);

  const filtered = age !== 'all' || sex !== 'all' || goal !== 'all' || search !== '';
  const reset = () => {
    setSearch('');
    setAge('all');
    setSex('all');
    setGoal('all');
  };

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
      <HStack gap="sm" wrap>
        <SelectMenu
          compact
          label={t('coach.filters.age')}
          value={age}
          onChange={setAge}
          options={[
            { value: 'all' as const, label: t('coach.filters.allAges') },
            ...AGE_BRACKETS.map((b) => ({
              value: b,
              label: t('coach.filters.ageBracket', { bracket: b.replace('-', '–') }),
            })),
          ]}
        />
        <SelectMenu
          compact
          label={t('coach.filters.sex')}
          value={sex}
          onChange={setSex}
          options={[
            { value: 'all' as const, label: t('coach.filters.allSexes') },
            ...SEXES.map((s) => ({ value: s, label: t(`enums.sex.${s}`) })),
          ]}
        />
        <SelectMenu
          compact
          label={t('coach.filters.goal')}
          value={goal}
          onChange={setGoal}
          options={[
            { value: 'all' as const, label: t('coach.filters.allGoals') },
            ...GOALS.map((g) => ({ value: g, label: t(`enums.goal.${g}`) })),
          ]}
        />
        <SelectMenu
          compact
          label={t('coach.filters.sort')}
          value={sort}
          onChange={setSort}
          options={ADHERENT_SORTS.map((s) => ({
            value: s,
            label: t(`coach.filters.sortBy.${s}`),
          }))}
        />
        {filtered ? (
          <Button variant="ghost" icon="close" label={t('coach.filters.reset')} onPress={reset} />
        ) : null}
      </HStack>
      {overview.isLoading ? (
        <LoadingState />
      ) : overview.isError ? (
        <ErrorState onRetry={() => void overview.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="people-outline" title={t('coach.noAdherents')} />
      ) : (
        <>
          {filtered ? (
            <Text color="textMuted">{t('coach.filters.results', { count: rows.length })}</Text>
          ) : null}
          <AdherentTable rows={rows} />
        </>
      )}
    </Screen>
  );
}
