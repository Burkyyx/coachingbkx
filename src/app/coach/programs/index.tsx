import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Segmented,
  SelectMenu,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  adherentLabel,
  filterAndSortPrograms,
  formatFrenchDate,
  PROGRAM_SORTS,
  type ProgramSort,
} from '@/core';
import { AssignSheet } from '@/features/programs/AssignSheet';
import {
  PROGRAM_STATUSES,
  useCreateTemplate,
  useDuplicateProgram,
  usePrograms,
} from '@/features/programs/api';
import { useTheme } from '@/theme/ThemeProvider';

/** Programmes : modèles réutilisables et programmes assignés aux adhérents. */
export default function ProgramsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { toast } = useFeedback();
  const [kind, setKind] = useState<'template' | 'assigned'>('template');
  const { data, isLoading, isError, refetch } = usePrograms(kind);
  const create = useCreateTemplate();
  const duplicate = useDuplicateProgram();
  const [assigning, setAssigning] = useState<{ id: string; name: string } | null>(null);
  const templates = usePrograms('template');

  // Recherche (les deux onglets) + filtres et tri (programmes des adhérents).
  const [search, setSearch] = useState('');
  const [adherentId, setAdherentId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [templateId, setTemplateId] = useState<string>('all');
  const [sort, setSort] = useState<ProgramSort>('updated');
  const assignedView = kind === 'assigned';

  const list = useMemo(
    () =>
      filterAndSortPrograms(
        data ?? [],
        assignedView
          ? {
              search,
              adherentId: adherentId === 'all' ? null : adherentId,
              status: status === 'all' ? null : status,
              templateId: templateId === 'all' ? null : templateId,
            }
          : { search },
        assignedView ? sort : 'updated',
      ),
    [data, search, adherentId, status, templateId, sort, assignedView],
  );

  // Options construites à partir des programmes existants.
  const adherentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of data ?? []) if (p.adherent_id) seen.set(p.adherent_id, adherentLabel(p) || '—');
    return [...seen.entries()]
      .sort((x, y) => x[1].localeCompare(y[1], 'fr'))
      .map(([value, label]) => ({ value, label }));
  }, [data]);
  const templateOptions = useMemo(() => {
    const used = new Set((data ?? []).map((p) => p.source_template_id).filter(Boolean));
    return (templates.data ?? [])
      .filter((tpl) => used.has(tpl.id))
      .map((tpl) => ({ value: tpl.id, label: tpl.name }));
  }, [data, templates.data]);

  const filtered =
    search !== '' ||
    (assignedView && (adherentId !== 'all' || status !== 'all' || templateId !== 'all'));
  const resetFilters = () => {
    setSearch('');
    setAdherentId('all');
    setStatus('all');
    setTemplateId('all');
  };

  const newTemplate = async () => {
    const id = await create.mutateAsync(t('programs.newTemplateName'));
    router.push(`/coach/programs/${id}`);
  };

  return (
    <Screen>
      <HStack justify="space-between" wrap>
        <Text variant="headline" accessibilityRole="header">
          {t('programs.title')}
        </Text>
        <Button
          icon="add"
          label={t('programs.newTemplate')}
          loading={create.isPending}
          onPress={() => void newTemplate()}
        />
      </HStack>
      <Segmented
        options={[
          { value: 'template' as const, label: t('programs.templates') },
          { value: 'assigned' as const, label: t('programs.assigned') },
        ]}
        value={kind}
        onChange={setKind}
      />
      <TextField
        placeholder={t('programs.filters.search')}
        value={search}
        onChangeText={setSearch}
        accessibilityLabel={t('common.search')}
      />
      {assignedView ? (
        <HStack gap="sm" wrap>
          <SelectMenu
            compact
            label={t('programs.filters.adherent')}
            value={adherentId}
            onChange={setAdherentId}
            options={[
              { value: 'all', label: t('programs.filters.allAdherents') },
              ...adherentOptions,
            ]}
          />
          <SelectMenu
            compact
            label={t('programs.filters.status')}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('programs.filters.allStatuses') },
              ...PROGRAM_STATUSES.map((st) => ({
                value: st,
                label: t(`enums.programStatus.${st}`),
              })),
            ]}
          />
          {templateOptions.length > 0 ? (
            <SelectMenu
              compact
              label={t('programs.filters.template')}
              value={templateId}
              onChange={setTemplateId}
              options={[
                { value: 'all', label: t('programs.filters.allTemplates') },
                ...templateOptions,
              ]}
            />
          ) : null}
          <SelectMenu
            compact
            label={t('programs.filters.sort')}
            value={sort}
            onChange={setSort}
            options={PROGRAM_SORTS.map((x) => ({
              value: x,
              label: t(`programs.filters.sortBy.${x}`),
            }))}
          />
          {filtered ? (
            <Button
              variant="ghost"
              icon="close"
              label={t('programs.filters.reset')}
              onPress={resetFilters}
            />
          ) : null}
        </HStack>
      ) : null}
      {filtered && data && data.length > 0 ? (
        <Text color="textMuted">{t('programs.filters.results', { count: list.length })}</Text>
      ) : null}
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title={kind === 'template' ? t('programs.emptyTemplates') : t('programs.emptyAssigned')}
          actionLabel={kind === 'template' ? t('programs.newTemplate') : undefined}
          onAction={kind === 'template' ? () => void newTemplate() : undefined}
        />
      ) : list.length === 0 ? (
        <EmptyState icon="search-outline" title={t('programs.filters.none')} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {list.map((p) => {
            const workoutCount = (p.workouts as unknown as { count: number }[])[0]?.count ?? 0;
            const adherent = p.adherent as {
              first_name: string | null;
              last_name: string | null;
            } | null;
            return (
              <Card key={p.id} style={{ flexGrow: 1, flexBasis: 320, maxWidth: 560 }}>
                <VStack gap="sm">
                  <HStack justify="space-between">
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={p.name}
                      onPress={() => router.push(`/coach/programs/${p.id}`)}
                      style={{ flex: 1 }}
                    >
                      <Text
                        variant="subtitle"
                        numberOfLines={2}
                        style={{ textDecorationLine: 'underline' }}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                    {kind === 'assigned' ? (
                      <Badge
                        label={t(`enums.programStatus.${p.status}`)}
                        tone={p.status === 'active' ? 'success' : 'neutral'}
                      />
                    ) : null}
                  </HStack>
                  {adherent ? (
                    <Text color="textMuted">
                      {t('programs.for', {
                        name: [adherent.first_name, adherent.last_name].filter(Boolean).join(' '),
                      })}
                    </Text>
                  ) : null}
                  <Text variant="small" color="textMuted">
                    {t('programs.weeks', { count: p.duration_weeks })} ·{' '}
                    {t('programs.workouts', { count: workoutCount })}
                    {p.start_date
                      ? ` · ${t('programs.startsOn', { date: formatFrenchDate(p.start_date) })}`
                      : ''}
                  </Text>
                  <HStack gap="xs">
                    <Button
                      variant="secondary"
                      icon="create-outline"
                      label={t('common.edit')}
                      onPress={() => router.push(`/coach/programs/${p.id}`)}
                    />
                    {kind === 'template' ? (
                      <>
                        <Button
                          variant="secondary"
                          icon="send-outline"
                          label={t('programs.assign')}
                          onPress={() => setAssigning({ id: p.id, name: p.name })}
                        />
                        <IconButton
                          icon="copy-outline"
                          label={t('common.duplicate')}
                          onPress={async () => {
                            await duplicate.mutateAsync(p.id);
                            toast(t('programs.duplicated'));
                          }}
                        />
                      </>
                    ) : null}
                  </HStack>
                </VStack>
              </Card>
            );
          })}
        </View>
      )}
      {assigning ? (
        <AssignSheet
          visible
          programId={assigning.id}
          programName={assigning.name}
          onClose={() => setAssigning(null)}
        />
      ) : null}
    </Screen>
  );
}
