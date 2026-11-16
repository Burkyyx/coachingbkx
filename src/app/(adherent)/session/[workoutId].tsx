import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  IconButton,
  ListRow,
  LoadingState,
  Screen,
  Segmented,
  Sheet,
  Stepper,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  formatDuration,
  formatKg,
  formatNumber,
  formatRepRange,
  formatTimer,
  type RecordDraft,
  type SessionSummary,
} from '@/core';
import { ExerciseVideo } from '@/features/exercises/ExerciseVideo';
import { useAdherentBundle } from '@/features/training/bundle';
import { exerciseHistory, scheduledWorkouts } from '@/features/training/derive';
import {
  EffortPicker,
  RecordCelebration,
  RestPanel,
  SetDots,
  useNow,
} from '@/features/training/session/components';
import { requestRestAlarmPermission, tap } from '@/features/training/session/restAlarm';
import { sessionActions, useActiveSession } from '@/features/training/session/store';
import { SyncBadge } from '@/offline/SyncBadge';

type Summary = SessionSummary & { records: RecordDraft[] };

/**
 * MODE SÉANCE — utilisable d'une main, écran toujours allumé, fonctionne sans réseau.
 */
export default function SessionScreen() {
  useKeepAwake();
  const { t } = useTranslation();
  const { confirm } = useFeedback();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const bundle = useAdherentBundle();
  const session = useActiveSession((s) => s.session);
  const hydrated = useActiveSession((s) => s.hydrated);
  const celebration = useActiveSession((s) => s.celebration);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sheet, setSheet] = useState<'info' | 'history' | 'replace' | 'list' | 'finish' | null>(
    null,
  );
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const now = useNow(1000);

  const workout = useMemo(
    () =>
      bundle.data ? scheduledWorkouts(bundle.data).find((w) => w.id === workoutId) : undefined,
    [bundle.data, workoutId],
  );

  // Démarrage automatique (une seule fois) si aucune séance n'est en cours.
  useEffect(() => {
    if (!hydrated || !bundle.data || !workout || session || summary || started.current) return;
    started.current = true;
    void requestRestAlarmPermission();
    void sessionActions.start(bundle.data, workout);
  }, [hydrated, bundle.data, workout, session, summary]);

  if (summary) return <SummaryView summary={summary} />;
  if (!hydrated || bundle.isLoading || !bundle.data) return <LoadingState />;
  if (session && session.workoutId !== workoutId) {
    return (
      <Screen>
        <EmptyState
          icon="barbell-outline"
          title={t('training.otherSessionActive')}
          body={t('training.otherSessionActiveBody', { name: session.workoutName })}
          actionLabel={t('training.resume')}
          onAction={() => router.replace(`/session/${session.workoutId ?? 'free'}`)}
        />
      </Screen>
    );
  }
  if (!session) {
    if (!workout) {
      return (
        <Screen>
          <EmptyState
            title={t('training.notFound')}
            actionLabel={t('training.backHome')}
            onAction={() => router.replace('/today')}
          />
        </Screen>
      );
    }
    return <LoadingState />;
  }

  const data = bundle.data;
  const exIdx = Math.min(session.current.ex, session.exercises.length - 1);
  const exercise = session.exercises[exIdx];
  if (!exercise) return <LoadingState />;
  const setIdx = Math.min(session.current.set, exercise.sets.length - 1);
  const set = exercise.sets[setIdx];
  const info = data.exercises.find((e) => e.id === exercise.exerciseId);
  const plannedInfo = data.exercises.find((e) => e.id === exercise.plannedExerciseId);
  const increment = Number(info?.load_increment_kg ?? 2.5);
  const timed = info?.type === 'timed' || info?.type === 'cardio';
  const remainingSets = session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.status === 'todo').length,
    0,
  );
  const alternatives = (exercise.workoutExerciseId
    ? workout?.exercises.find((w) => w.id === exercise.workoutExerciseId)?.alternative_exercise_ids
    : undefined
  )?.length
    ? (workout?.exercises.find((w) => w.id === exercise.workoutExerciseId)
        ?.alternative_exercise_ids ?? [])
    : (data.alternatives[exercise.plannedExerciseId] ?? []);
  const history = exerciseHistory(data, exercise.exerciseId, session.id).slice(-3).reverse();

  const goExercise = (i: number) => {
    const target = session.exercises[i];
    if (!target) return;
    const firstTodo = target.sets.findIndex((s) => s.status === 'todo');
    void sessionActions.goTo(i, firstTodo >= 0 ? firstTodo : 0);
  };

  const validate = async (completed: boolean) => {
    if (!set || busy) return;
    setBusy(true);
    tap(completed ? 'light' : 'warning');
    await sessionActions.validate(exIdx, setIdx, completed, data);
    setBusy(false);
  };

  const finish = async () => {
    setBusy(true);
    const result = await sessionActions.finish({ rating, notes }, data);
    setBusy(false);
    setSheet(null);
    if (result) setSummary(result);
  };

  const elapsed = (now - Date.parse(session.startedAt)) / 1000;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        maxWidth={640}
        padded
        footer={
          session.rest ? (
            <RestPanel
              rest={session.rest}
              onAdjust={(d) => void sessionActions.adjustRest(d)}
              onResume={() => void sessionActions.endRest()}
            />
          ) : undefined
        }
      >
        {/* En-tête */}
        <HStack justify="space-between">
          <VStack gap="xxs" flex={1}>
            <Text variant="subtitle" numberOfLines={1}>
              {session.workoutName}
            </Text>
            <Text variant="caption" color="textSubtle" tabular>
              {t('training.elapsed')} {formatTimer(elapsed)}
            </Text>
          </VStack>
          <SyncBadge />
          <IconButton
            icon="list"
            label={t('training.allExercises')}
            onPress={() => setSheet('list')}
            filled
          />
          <Button label={t('training.finish')} onPress={() => setSheet('finish')} />
        </HStack>

        {/* Exercice courant */}
        <Card>
          <VStack gap="md">
            <HStack justify="space-between">
              <Text variant="caption" color="textSubtle">
                {t('training.exerciseOf', { current: exIdx + 1, total: session.exercises.length })}
              </Text>
              {exercise.supersetGroup ? (
                <Badge tone="info" label={`Superset ${exercise.supersetGroup}`} />
              ) : null}
            </HStack>
            <Text variant="headline">{info?.name ?? '—'}</Text>
            {exercise.exerciseId !== exercise.plannedExerciseId ? (
              <Text variant="small" color="textMuted">
                {t('training.replacedBy', { name: plannedInfo?.name ?? '' })}
              </Text>
            ) : null}
            {exercise.coachNotes ? (
              <Text color="textMuted">
                <Text weight="700">{t('training.coachNotes')} : </Text>
                {exercise.coachNotes}
              </Text>
            ) : null}
            {exercise.hint ? (
              <Badge tone="highlight" icon="flag-outline" label={exercise.hint} />
            ) : null}
            <HStack gap="xs" wrap>
              <Button
                variant="secondary"
                icon="information-circle-outline"
                label={t('training.instructions')}
                onPress={() => setSheet('info')}
              />
              <Button
                variant="secondary"
                icon="time-outline"
                label={t('training.history')}
                onPress={() => setSheet('history')}
              />
              <Button
                variant="secondary"
                icon="swap-horizontal"
                label={t('training.replace')}
                onPress={() => setSheet('replace')}
              />
            </HStack>
            <SetDots
              sets={exercise.sets}
              current={setIdx}
              onSelect={(i) => void sessionActions.goTo(exIdx, i)}
            />
          </VStack>
        </Card>

        {/* Saisie de la série */}
        {set ? (
          <Card>
            <VStack gap="lg">
              <HStack justify="space-between" wrap>
                <Text variant="subtitle">
                  {set.setType === 'warmup'
                    ? t('training.warmup')
                    : t('training.setOf', { current: setIdx + 1, total: exercise.sets.length })}
                </Text>
                <Text color="textMuted">
                  {t('training.target')} :{' '}
                  {timed && set.durationSeconds
                    ? formatDuration(set.durationSeconds)
                    : `${formatRepRange(set.repsMin, set.repsMax)} reps`}
                  {set.targetLoadKg !== null ? ` · ${formatKg(set.targetLoadKg)}` : ''}
                  {set.targetRir !== null
                    ? ` · RIR ${formatNumber(set.targetRir)}`
                    : set.targetRpe !== null
                      ? ` · RPE ${formatNumber(set.targetRpe)}`
                      : ''}
                  {set.tempo ? ` · tempo ${set.tempo}` : ''}
                </Text>
              </HStack>
              {set.missingReference1rm ? (
                <Text variant="small" color="warning">
                  {t('training.missing1rm')}
                </Text>
              ) : null}
              <HStack gap="md" align="flex-start" wrap>
                {info?.type !== 'bodyweight' && info?.type !== 'cardio' ? (
                  <View style={{ flex: 1, minWidth: 240 }}>
                    <Stepper
                      large
                      label={t('training.load')}
                      unit="kg"
                      value={set.loadKg}
                      step={increment}
                      decimals={2}
                      max={1000}
                      onChange={(v) => void sessionActions.update(exIdx, setIdx, { loadKg: v })}
                    />
                  </View>
                ) : null}
                <View style={{ flex: 1, minWidth: 240 }}>
                  {timed ? (
                    <Stepper
                      large
                      label={t('training.duration')}
                      value={set.durationSeconds}
                      step={5}
                      max={7200}
                      onChange={(v) =>
                        void sessionActions.update(exIdx, setIdx, { durationSeconds: v })
                      }
                    />
                  ) : (
                    <Stepper
                      large
                      label={t('training.reps')}
                      value={set.reps}
                      step={1}
                      max={500}
                      onChange={(v) => void sessionActions.update(exIdx, setIdx, { reps: v })}
                    />
                  )}
                </View>
              </HStack>
              {set.setType !== 'warmup' ? (
                <EffortPicker
                  scale={session.effortScale}
                  value={session.effortScale === 'rir' ? set.rir : set.rpe}
                  onChange={(v) =>
                    void sessionActions.update(
                      exIdx,
                      setIdx,
                      session.effortScale === 'rir' ? { rir: v } : { rpe: v },
                    )
                  }
                />
              ) : null}
              <TextField
                label={`${t('training.note')} (${t('common.optional')})`}
                placeholder={t('training.notePlaceholder')}
                value={set.note ?? ''}
                onChangeText={(v) => void sessionActions.update(exIdx, setIdx, { note: v || null })}
              />
              <Button
                size="xl"
                icon="checkmark"
                label={set.status === 'todo' ? t('training.validate') : t('training.validated')}
                loading={busy}
                onPress={() => void validate(true)}
                fullWidth
              />
              <HStack justify="space-between">
                <Button
                  variant="ghost"
                  icon="close"
                  label={t('training.failed')}
                  onPress={() => void validate(false)}
                />
                <Button
                  variant="ghost"
                  icon="add"
                  label={t('training.addSet')}
                  onPress={() => void sessionActions.addSet(exIdx)}
                />
              </HStack>
            </VStack>
          </Card>
        ) : null}

        <HStack gap="sm">
          <Button
            variant="secondary"
            icon="chevron-back"
            label={t('training.previous')}
            disabled={exIdx === 0}
            onPress={() => goExercise(exIdx - 1)}
            style={{ flex: 1 }}
          />
          <Button
            variant="secondary"
            icon="chevron-forward"
            label={t('training.next')}
            disabled={exIdx >= session.exercises.length - 1}
            onPress={() => goExercise(exIdx + 1)}
            style={{ flex: 1 }}
          />
        </HStack>
      </Screen>

      {celebration ? (
        <RecordCelebration record={celebration} onDone={sessionActions.clearCelebration} />
      ) : null}

      {/* Consignes et vidéo */}
      <Sheet visible={sheet === 'info'} onClose={() => setSheet(null)} title={info?.name ?? ''}>
        <ExerciseVideo path={info?.video_path ?? null} url={info?.video_url ?? null} />
        <Text>{info?.instructions ?? t('exercises.instructionsEmpty')}</Text>
      </Sheet>

      {/* Historique */}
      <Sheet
        visible={sheet === 'history'}
        onClose={() => setSheet(null)}
        title={t('training.history')}
      >
        {history.length === 0 ? <Text color="textMuted">{t('training.noHistory')}</Text> : null}
        {history.map((h) => (
          <VStack key={h.sessionId} gap="xxs">
            <Text weight="700">
              {new Date(h.date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            {h.sets
              .filter((s) => s.setType !== 'warmup')
              .map((s, i) => (
                <Text key={`${h.sessionId}-${i}`} color="textMuted" tabular>
                  {i + 1}. {s.loadKg !== null ? `${formatKg(s.loadKg)} × ` : ''}
                  {s.reps ?? '—'} reps
                  {s.rir !== null
                    ? ` · RIR ${formatNumber(s.rir)}`
                    : s.rpe !== null
                      ? ` · RPE ${formatNumber(s.rpe)}`
                      : ''}
                  {s.completed ? '' : ` · ${t('training.failedShort')}`}
                </Text>
              ))}
          </VStack>
        ))}
      </Sheet>

      {/* Remplacement */}
      <Sheet
        visible={sheet === 'replace'}
        onClose={() => setSheet(null)}
        title={t('training.replaceTitle')}
      >
        {alternatives.length === 0 ? (
          <Text color="textMuted">{t('training.noAlternative')}</Text>
        ) : null}
        {[exercise.plannedExerciseId, ...alternatives]
          .filter((id) => id !== exercise.exerciseId)
          .map((id) => (
            <ListRow
              key={id}
              icon="swap-horizontal"
              title={data.exercises.find((e) => e.id === id)?.name ?? '—'}
              onPress={() => {
                void sessionActions.replace(exIdx, id, data);
                setSheet(null);
              }}
            />
          ))}
      </Sheet>

      {/* Liste des exercices */}
      <Sheet
        visible={sheet === 'list'}
        onClose={() => setSheet(null)}
        title={t('training.allExercises')}
      >
        {session.exercises.map((e, i) => {
          const done = e.sets.filter((s) => s.status !== 'todo').length;
          return (
            <ListRow
              key={e.key}
              title={`${e.supersetGroup ? `${e.supersetGroup} · ` : ''}${data.exercises.find((x) => x.id === e.exerciseId)?.name ?? '—'}`}
              subtitle={`${done}/${e.sets.length} ${t('training.setsCount', { count: e.sets.length }).split(' ').slice(1).join(' ')}`}
              icon={
                done === e.sets.length
                  ? 'checkmark-circle'
                  : i === exIdx
                    ? 'play-circle-outline'
                    : 'ellipse-outline'
              }
              onPress={() => {
                goExercise(i);
                setSheet(null);
              }}
            />
          );
        })}
      </Sheet>

      {/* Fin de séance */}
      <Sheet
        visible={sheet === 'finish'}
        onClose={() => setSheet(null)}
        title={t('training.finishTitle')}
        footer={
          <VStack gap="sm">
            <Button
              size="lg"
              icon="checkmark-done"
              label={t('training.save')}
              loading={busy}
              onPress={() => void finish()}
              fullWidth
            />
            <Button
              variant="ghost"
              label={t('training.abandon')}
              onPress={async () => {
                const ok = await confirm({
                  title: t('training.abandon'),
                  message: t('training.abandonConfirm'),
                  destructive: true,
                  confirmLabel: t('training.abandon'),
                });
                if (ok) {
                  await sessionActions.abandon();
                  router.replace('/today');
                }
              }}
            />
          </VStack>
        }
      >
        {remainingSets > 0 ? (
          <Text color="warning">{t('training.unfinishedSets', { count: remainingSets })}</Text>
        ) : null}
        <Text weight="700">{t('training.ratingQuestion')}</Text>
        <Text variant="caption" color="textSubtle">
          {t('training.ratingHint')}
        </Text>
        <Segmented
          options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
          value={rating}
          onChange={setRating}
          accessibilityLabel={t('training.ratingQuestion')}
        />
        <TextField
          label={t('training.sessionNotes')}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Sheet>
    </View>
  );
}

/** Résumé affiché à la fin de la séance. */
function SummaryView({ summary }: { summary: Summary }) {
  const { t } = useTranslation();
  const stat = (label: string, value: string) => (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Text variant="caption" color="textSubtle">
        {label}
      </Text>
      <Text variant="title" tabular>
        {value}
      </Text>
    </Card>
  );
  return (
    <Screen maxWidth={640}>
      <Text variant="headline" align="center" style={{ marginTop: 24 }}>
        {t('training.summaryTitle')}
      </Text>
      <HStack gap="sm" wrap>
        {stat(t('training.summaryDuration'), formatDuration(summary.durationSeconds))}
        {stat(t('training.summaryVolume'), formatKg(summary.totalVolumeKg))}
        {stat(t('training.summarySets'), String(summary.completedSets))}
        {stat(t('training.summaryRecords'), String(summary.records.length))}
      </HStack>
      {summary.records.map((r, i) => (
        <Card key={i}>
          <Text>
            🏆{' '}
            {t(`training.recordTypes.${r.recordType}`, {
              value: formatNumber(r.value),
              load: r.loadKg !== null ? formatNumber(r.loadKg) : '',
            })}
          </Text>
        </Card>
      ))}
      <SyncBadge />
      <Button
        size="xl"
        label={t('training.backHome')}
        onPress={() => router.replace('/today')}
        fullWidth
      />
    </Screen>
  );
}
