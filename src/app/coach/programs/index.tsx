import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

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
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatFrenchDate } from '@/core';
import { AssignSheet } from '@/features/programs/AssignSheet';
import { useCreateTemplate, useDuplicateProgram, usePrograms } from '@/features/programs/api';
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
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {data.map((p) => {
            const workoutCount = (p.workouts as unknown as { count: number }[])[0]?.count ?? 0;
            const adherent = p.adherent as {
              first_name: string | null;
              last_name: string | null;
            } | null;
            return (
              <Card
                key={p.id}
                onPress={() => router.push(`/coach/programs/${p.id}`)}
                accessibilityLabel={p.name}
                style={{ flexGrow: 1, flexBasis: 320, maxWidth: 560 }}
              >
                <VStack gap="sm">
                  <HStack justify="space-between">
                    <Text variant="subtitle" style={{ flex: 1 }} numberOfLines={2}>
                      {p.name}
                    </Text>
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
                  {kind === 'template' ? (
                    <HStack gap="xs">
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
                    </HStack>
                  ) : null}
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
