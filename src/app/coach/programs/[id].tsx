import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, useWindowDimensions } from 'react-native';

import {
  Badge,
  Button,
  Card,
  CommitTextField,
  EmptyState,
  ErrorState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Segmented,
  SelectMenu,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatFrenchDate, formatNumber, parseFrenchDate } from '@/core';
import { useExercises } from '@/features/exercises/api';
import { AssignSheet } from '@/features/programs/AssignSheet';
import {
  PROGRAM_STATUSES,
  useDuplicateProgram,
  useProgramActions,
  useProgramTree,
} from '@/features/programs/api';
import type { EffortMode } from '@/features/programs/SetRow';
import { WorkoutCard } from '@/features/programs/WorkoutCard';
import { toUserMessage } from '@/lib/errors';
import { useKeyboardShortcuts } from '@/lib/useKeyboardShortcuts';

/** Constructeur de programme : semaines → séances → exercices → séries. */
export default function ProgramEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const { width } = useWindowDimensions();
  const compact = width < 1100;
  const tree = useProgramTree(id);
  const { data: exercises = [] } = useExercises();
  const exercisesById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const duplicate = useDuplicateProgram();

  const [week, setWeek] = useState(1);
  const [assignOpen, setAssignOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [effortChoice, setEffortChoice] = useState<EffortMode | null>(null);

  const program = tree.data?.program;
  const isActiveAssigned = program?.kind === 'assigned' && program.status === 'active';
  const actions = useProgramActions(id, () => {
    if (isActiveAssigned) setDirty(true);
  });

  // Prévenir automatiquement l'adhérent en quittant l'écran si le programme a changé.
  const pendingNotify = useRef(false);
  useEffect(() => {
    pendingNotify.current = dirty;
  }, [dirty]);
  const notifyRef = useRef(actions.notifyAdherent);
  useEffect(() => {
    notifyRef.current = actions.notifyAdherent;
  });
  useEffect(
    () => () => {
      if (pendingNotify.current) void notifyRef.current().catch(() => undefined);
    },
    [],
  );

  const weeks = program?.duration_weeks ?? 1;
  const currentWeek = Math.min(week, weeks);
  const workouts = (tree.data?.workouts ?? []).filter((w) => w.week_index === currentWeek);
  const adjustment = tree.data?.adjustments.find((a) => a.week_index === currentWeek);

  // Mode d'effort affiché : RPE si le programme n'utilise que des RPE, sinon RIR.
  const allSets = (tree.data?.workouts ?? []).flatMap((w) => w.exercises.flatMap((e) => e.sets));
  const inferred: EffortMode =
    allSets.some((s) => s.target_rpe !== null) && !allSets.some((s) => s.target_rir !== null)
      ? 'rpe'
      : 'rir';
  const effortMode = effortChoice ?? inferred;
  const usesPct = allSets.some((s) => s.load_pct_1rm !== null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  const addWorkout = () =>
    run(async () => {
      const usedDays = new Set(workouts.map((w) => w.day_of_week));
      const day = [1, 3, 5, 2, 4, 6, 7].find((d) => !usedDays.has(d)) ?? 1;
      await actions.addWorkout(
        currentWeek,
        day,
        `${t('programs.defaultWorkoutName')} ${workouts.length + 1}`,
      );
    });

  useKeyboardShortcuts({
    n: () => void addWorkout(),
    s: () => void run(() => actions.addWeek()),
    '[': () => setWeek((w) => Math.max(1, w - 1)),
    ']': () => setWeek((w) => Math.min(weeks, w + 1)),
    '?': () => setShowHelp((v) => !v),
  });

  if (tree.isLoading) return <LoadingState />;
  if (tree.isError || !tree.data || !program) {
    return (
      <Screen>
        <ErrorState onRetry={() => void tree.refetch()} />
      </Screen>
    );
  }

  const adherentName = tree.data.adherent
    ? [tree.data.adherent.first_name, tree.data.adherent.last_name].filter(Boolean).join(' ')
    : null;

  const moveWorkout = (index: number, dir: -1 | 1) => {
    const ids = workouts.map((w) => w.id);
    const [m] = ids.splice(index, 1);
    if (m) ids.splice(index + dir, 0, m);
    void run(() => actions.reorder('workouts', ids));
  };

  return (
    <Screen maxWidth={1400}>
      <HStack justify="space-between" wrap>
        <Button
          variant="ghost"
          icon="arrow-back"
          label={t('nav.programs')}
          onPress={() => router.navigate('/coach/programs')}
        />
        <HStack gap="xs" wrap>
          {program.kind === 'template' ? (
            <Button
              icon="send-outline"
              label={t('programs.assign')}
              onPress={() => setAssignOpen(true)}
            />
          ) : null}
          <Button
            variant="secondary"
            icon="copy-outline"
            label={t('programs.duplicate')}
            onPress={() =>
              void run(async () => {
                const newId = await duplicate.mutateAsync(id);
                toast(t('programs.duplicated'));
                if (newId) router.push(`/coach/programs/${newId}`);
              })
            }
          />
          <IconButton
            icon="trash-outline"
            label={t('programs.deleteProgram')}
            onPress={async () => {
              const ok = await confirm({
                title: t('programs.deleteProgram'),
                message: t('programs.deleteProgramConfirm'),
                destructive: true,
                confirmLabel: t('common.delete'),
              });
              if (ok) {
                await actions.deleteProgram();
                router.navigate('/coach/programs');
              }
            }}
          />
          <IconButton
            icon="help-circle-outline"
            label={t('programs.shortcuts')}
            onPress={() => setShowHelp((v) => !v)}
          />
        </HStack>
      </HStack>

      {showHelp ? (
        <Card>
          <Text variant="small" color="textMuted">
            {t('programs.shortcutsHelp')}
          </Text>
        </Card>
      ) : null}

      {dirty && isActiveAssigned ? (
        <Card>
          <HStack justify="space-between" wrap>
            <Text style={{ flex: 1 }}>
              {t('programs.notifyPending', { name: adherentName ?? '' })}
            </Text>
            <Button
              variant="secondary"
              icon="notifications-outline"
              label={t('programs.notifyNow')}
              onPress={() =>
                void run(async () => {
                  await actions.notifyAdherent();
                  setDirty(false);
                  toast(t('programs.notified'));
                })
              }
            />
          </HStack>
        </Card>
      ) : null}

      <Card>
        <VStack gap="md">
          <CommitTextField
            label={t('programs.name')}
            value={program.name}
            onCommit={(v) => {
              if (v) void run(() => actions.updateProgram({ name: v }));
            }}
          />
          <CommitTextField
            label={t('programs.description')}
            value={program.description ?? ''}
            multiline
            onCommit={(v) => void run(() => actions.updateProgram({ description: v || null }))}
          />
          {program.kind === 'assigned' ? (
            <HStack gap="md" wrap align="flex-end">
              {adherentName ? (
                <Badge label={t('programs.for', { name: adherentName })} icon="person-outline" />
              ) : null}
              <View style={{ width: 200 }}>
                <CommitTextField
                  label={t('programs.startDate')}
                  value={program.start_date ? formatFrenchDate(program.start_date) : ''}
                  onCommit={(v) => {
                    const iso = parseFrenchDate(v);
                    if (iso && iso !== program.start_date)
                      void run(() => actions.updateProgram({ start_date: iso }));
                  }}
                />
              </View>
              <View style={{ width: 180 }}>
                <SelectMenu
                  label={t('programs.status')}
                  value={program.status}
                  options={PROGRAM_STATUSES.map((s) => ({
                    value: s,
                    label: t(`enums.programStatus.${s}`),
                  }))}
                  onChange={(s) => void run(() => actions.updateProgram({ status: s }))}
                />
              </View>
            </HStack>
          ) : null}
        </VStack>
      </Card>

      {usesPct && program.kind === 'assigned' ? (
        <Text variant="small" color="warning">
          {t('programs.missing1rm')}
        </Text>
      ) : null}
      {error ? <Text color="danger">{error}</Text> : null}

      <HStack gap="sm" wrap>
        <View style={{ flexShrink: 1 }}>
          <Segmented
            scrollable
            accessibilityLabel={t('programs.duration')}
            options={Array.from({ length: weeks }, (_, i) => ({
              value: i + 1,
              label: `${t('programs.week', { n: i + 1 })}${tree.data.adjustments.some((a) => a.week_index === i + 1) ? ' ⤵' : ''}`,
            }))}
            value={currentWeek}
            onChange={setWeek}
          />
        </View>
        <Button
          variant="secondary"
          icon="add"
          label={t('programs.addWeek')}
          onPress={() => void run(() => actions.addWeek())}
        />
      </HStack>

      <HStack gap="sm" wrap>
        <Button
          variant="ghost"
          icon="copy-outline"
          label={t('programs.duplicateWeek')}
          onPress={() =>
            void run(async () => {
              await actions.duplicateWeek(currentWeek);
              toast(t('programs.duplicateWeekTo', { from: currentWeek, to: weeks + 1 }));
              setWeek(weeks + 1);
            })
          }
        />
        {weeks > 1 ? (
          <Button
            variant="ghost"
            icon="trash-outline"
            label={t('programs.deleteWeek')}
            onPress={async () => {
              const ok = await confirm({
                title: t('programs.deleteWeek'),
                message: t('programs.deleteWeekConfirm', { n: currentWeek }),
                destructive: true,
                confirmLabel: t('common.delete'),
              });
              if (ok) {
                await run(() => actions.deleteWeek(currentWeek));
                setWeek((w) => Math.max(1, w - 1));
              }
            }}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <View style={{ width: 220 }}>
          <Segmented
            options={[
              { value: 'rir' as const, label: t('programs.targetRir') },
              { value: 'rpe' as const, label: t('programs.targetRpe') },
            ]}
            value={effortMode}
            onChange={setEffortChoice}
          />
        </View>
      </HStack>

      {adjustment ? (
        <Card>
          <HStack justify="space-between" wrap>
            <Badge
              tone="info"
              icon="trending-down"
              label={t('programs.deloadInfo', {
                factor: formatNumber(Number(adjustment.volume_factor)),
              })}
            />
            <Button
              variant="ghost"
              label={t('programs.removeDeload')}
              onPress={() => void run(() => actions.removeAdjustment(adjustment.id))}
            />
          </HStack>
        </Card>
      ) : null}

      {workouts.length === 0 ? (
        <EmptyState icon="calendar-outline" title={t('programs.emptyWeek')} />
      ) : (
        workouts.map((w, index) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            exercisesById={exercisesById}
            effortMode={effortMode}
            compact={compact}
            actions={actions}
            canMoveUp={index > 0}
            canMoveDown={index < workouts.length - 1}
            onMove={(dir) => moveWorkout(index, dir)}
          />
        ))
      )}
      <Button icon="add" label={t('programs.addWorkout')} onPress={() => void addWorkout()} />

      <AssignSheet
        visible={assignOpen}
        onClose={() => setAssignOpen(false)}
        programId={id}
        programName={program.name}
      />
    </Screen>
  );
}
