import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { ReorderList } from '@/components/ReorderList';
import {
  Button,
  Card,
  HStack,
  IconButton,
  SelectMenu,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import type { Exercise } from '@/features/exercises/api';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { useTheme } from '@/theme/ThemeProvider';

import type { ExerciseNode, ProgramActions, WorkoutNode } from './api';
import { SetHeader, SetRow, type EffortMode } from './SetRow';

const SUPERSET_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Champ texte enregistré à la sortie (nom de séance, notes). */
function InlineText({
  value,
  onCommit,
  label,
  placeholder,
  multiline,
  big,
}: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  big?: boolean;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
    setDraft(null);
  };
  return (
    <TextInput
      accessibilityLabel={label}
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={multiline ? undefined : commit}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSubtle}
      multiline={multiline}
      style={[
        big ? theme.typography.subtitle : theme.typography.small,
        {
          flex: 1,
          minHeight: big ? 44 : 36,
          color: theme.colors.text,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: draft !== null ? theme.colors.primary : 'transparent',
          backgroundColor: big ? 'transparent' : theme.colors.surfaceAlt,
        },
      ]}
    />
  );
}

function ExerciseBlock({
  node,
  exercise,
  handle,
  index,
  count,
  effortMode,
  compact,
  actions,
  onMove,
}: {
  node: ExerciseNode;
  exercise: Exercise | undefined;
  handle: ReactNode;
  index: number;
  count: number;
  effortMode: EffortMode;
  compact: boolean;
  actions: ProgramActions;
  onMove: (dir: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { confirm } = useFeedback();
  const timed = exercise?.type === 'timed' || exercise?.type === 'cardio';
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderLeftWidth: node.superset_group ? 4 : 1,
        borderLeftColor: node.superset_group ? theme.colors.info : theme.colors.border,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.background,
      }}
    >
      <HStack gap="xs" wrap>
        {handle}
        <Text weight="700" style={{ flex: 1, minWidth: 140 }}>
          {exercise?.name ?? '—'}
        </Text>
        <View style={{ width: 120 }}>
          <SelectMenu
            compact
            label={t('programs.superset')}
            value={node.superset_group ?? '-'}
            options={[
              { value: '-', label: `${t('programs.superset')} : ${t('programs.noSuperset')}` },
              ...SUPERSET_LETTERS.map((l) => ({
                value: l,
                label: `${t('programs.superset')} ${l}`,
              })),
            ]}
            onChange={(v) =>
              void actions.updateWorkoutExercise(node.id, { superset_group: v === '-' ? null : v })
            }
          />
        </View>
        <IconButton
          icon="arrow-up"
          label={t('programs.moveUp')}
          size={18}
          disabled={index === 0}
          onPress={() => onMove(-1)}
        />
        <IconButton
          icon="arrow-down"
          label={t('programs.moveDown')}
          size={18}
          disabled={index === count - 1}
          onPress={() => onMove(1)}
        />
        <IconButton
          icon="close"
          label={t('programs.removeExercise')}
          size={18}
          color="textMuted"
          onPress={async () => {
            const ok = await confirm({
              title: t('programs.removeExercise'),
              message: exercise?.name,
              destructive: true,
              confirmLabel: t('common.delete'),
            });
            if (ok) void actions.deleteWorkoutExercise(node.id);
          }}
        />
      </HStack>
      {!compact ? <SetHeader effortMode={effortMode} timed={timed} /> : null}
      {node.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          index={i}
          effortMode={effortMode}
          timed={timed}
          compact={compact}
          onUpdate={(patch) => void actions.updateSet(s.id, patch)}
          onDelete={() => void actions.deleteSet(s.id)}
        />
      ))}
      <HStack gap="sm" wrap>
        <Button
          variant="ghost"
          icon="add"
          label={t('programs.addSet')}
          onPress={() => void actions.addSet(node.id)}
        />
        <InlineText
          label={t('programs.coachNotes')}
          placeholder={`${t('programs.coachNotes')}…`}
          value={node.coach_notes ?? ''}
          onCommit={(v) => void actions.updateWorkoutExercise(node.id, { coach_notes: v || null })}
        />
      </HStack>
    </View>
  );
}

type Props = {
  workout: WorkoutNode;
  exercisesById: Map<string, Exercise>;
  effortMode: EffortMode;
  compact: boolean;
  actions: ProgramActions;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
};

/** Une séance du programme : nom, jour, exercices et séries. */
export function WorkoutCard({
  workout,
  exercisesById,
  effortMode,
  compact,
  actions,
  canMoveUp,
  canMoveDown,
  onMove,
}: Props) {
  const { t } = useTranslation();
  const { confirm } = useFeedback();
  const [picker, setPicker] = useState(false);
  const ids = workout.exercises.map((e) => e.id);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...ids];
    const [m] = next.splice(index, 1);
    if (m) next.splice(index + dir, 0, m);
    void actions.reorder('workout_exercises', next);
  };

  return (
    <Card>
      <VStack gap="md">
        <HStack gap="xs" wrap>
          <InlineText
            big
            label={t('programs.workoutName')}
            value={workout.name}
            onCommit={(v) =>
              void actions.updateWorkout(workout.id, {
                name: v || t('programs.defaultWorkoutName'),
              })
            }
          />
          <View style={{ width: 120 }}>
            <SelectMenu
              label={t('programs.day')}
              value={workout.day_of_week}
              options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({
                value: d,
                label: t(`enums.weekday.${d}` as 'enums.weekday.1'),
              }))}
              onChange={(d) => void actions.updateWorkout(workout.id, { day_of_week: d })}
            />
          </View>
          <IconButton
            icon="arrow-up"
            label={t('programs.moveUp')}
            disabled={!canMoveUp}
            onPress={() => onMove(-1)}
          />
          <IconButton
            icon="arrow-down"
            label={t('programs.moveDown')}
            disabled={!canMoveDown}
            onPress={() => onMove(1)}
          />
          <IconButton
            icon="copy-outline"
            label={t('programs.duplicateWorkout')}
            onPress={() => void actions.duplicateWorkout(workout.id)}
          />
          <IconButton
            icon="trash-outline"
            label={t('programs.deleteWorkout')}
            onPress={async () => {
              const ok = await confirm({
                title: t('programs.deleteWorkout'),
                message: t('programs.deleteWorkoutConfirm', { name: workout.name }),
                destructive: true,
                confirmLabel: t('common.delete'),
              });
              if (ok) void actions.deleteWorkout(workout.id);
            }}
          />
        </HStack>
        <ReorderList
          items={workout.exercises}
          keyOf={(e) => e.id}
          handleLabel={t('programs.dragHandle')}
          onReorder={(keys) => void actions.reorder('workout_exercises', keys)}
          renderItem={(node, handle, index) => (
            <ExerciseBlock
              node={node}
              exercise={exercisesById.get(node.exercise_id)}
              handle={handle}
              index={index}
              count={workout.exercises.length}
              effortMode={effortMode}
              compact={compact}
              actions={actions}
              onMove={(dir) => move(index, dir)}
            />
          )}
        />
        <Button
          variant="secondary"
          icon="add"
          label={t('programs.addExercise')}
          onPress={() => setPicker(true)}
        />
      </VStack>
      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPickMany={(exerciseIds) => void actions.addExercises(workout.id, exerciseIds)}
      />
    </Card>
  );
}
