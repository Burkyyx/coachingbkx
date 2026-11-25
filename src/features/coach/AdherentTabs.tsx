import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { LineChartCard } from '@/components/LineChartCard';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  Icon,
  IconButton,
  LoadingState,
  NumberCell,
  Segmented,
  SelectMenu,
  Text,
  TextField,
  VStack,
  useFeedback,
  SectionHeader,
} from '@/components/ui';
import {
  exerciseProgress,
  formatDuration,
  formatFrenchDate,
  formatKg,
  formatLongDate,
  formatNumber,
  formatShortDate,
  formatTime,
  todayLocal,
  weightTrend,
  type ExerciseSession,
} from '@/core';
import { ageOn } from '@/features/auth/consents';
import { useExercises } from '@/features/exercises/api';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { toLoggedSet } from '@/features/training/derive';
import { toUserMessage } from '@/lib/errors';
import type { Tables } from '@/lib/supabase';
import { useSignedUrl } from '@/lib/storage';
import { useTheme } from '@/theme/ThemeProvider';

import { RuleEditor } from './RuleEditor';
import {
  useActiveProgram,
  useAdherentActions,
  useAdherentCheckins,
  useAdherentRecords,
  useAdherentSessions,
  useAdherentWeights,
  useCoachNotes,
  useReference1rm,
  type SessionWithSets,
} from './adherent';

type Profile = Tables<'profiles'>;

function Info({ label, value }: { label: string; value: string }) {
  return (
    <VStack gap="xxs" style={{ minWidth: 140 }}>
      <Text variant="caption" color="textSubtle">
        {label}
      </Text>
      <Text weight="600">{value}</Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
export function ProfileTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const programs = useActiveProgram(profile.id);
  const weights = useAdherentWeights(profile.id);
  const points = (weights.data ?? []).map((w) => ({
    date: w.measured_on,
    kg: Number(w.weight_kg),
  }));
  const trend = weightTrend(points);
  return (
    <VStack gap="lg">
      <Card>
        <HStack gap="xl" wrap align="flex-start">
          {profile.birth_date ? (
            <Info
              label={t('onboarding.birthDate').split(' (')[0] ?? ''}
              value={t('adherent.age', { count: ageOn(profile.birth_date, todayLocal()) })}
            />
          ) : null}
          <Info
            label={t('adherent.goal')}
            value={profile.goal ? t(`enums.goal.${profile.goal}`) : '—'}
          />
          <Info
            label={t('adherent.level')}
            value={profile.level ? t(`enums.level.${profile.level}`) : '—'}
          />
          <Info
            label={t('adherent.activity')}
            value={profile.activity_level ? t(`enums.activity.${profile.activity_level}`) : '—'}
          />
          <Info
            label={t('adherent.height')}
            value={profile.height_cm ? `${formatNumber(Number(profile.height_cm))} cm` : '—'}
          />
          <Info
            label={t('onboarding.sex')}
            value={profile.sex ? t(`enums.sex.${profile.sex}`) : '—'}
          />
        </HStack>
      </Card>
      <Card>
        <VStack gap="xs">
          <Text weight="700">{t('adherent.injuries')}</Text>
          <Text color={profile.injuries ? 'text' : 'textMuted'}>
            {profile.injuries ?? t('adherent.noInjuries')}
          </Text>
        </VStack>
      </Card>
      <Card accent={theme.accent.program}>
        <VStack gap="sm">
          <SectionHeader
            title={t('adherent.currentProgram')}
            icon="clipboard"
            accent={theme.accent.program}
          />
          {(programs.data ?? []).length === 0 ? (
            <Text color="textMuted">{t('adherent.noProgram')}</Text>
          ) : null}
          {(programs.data ?? []).map((p) => (
            <HStack key={p.id} justify="space-between" wrap>
              <VStack gap="xxs">
                <Text weight="600">{p.name}</Text>
                <Text variant="small" color="textMuted">
                  {p.start_date
                    ? t('programs.startsOn', { date: formatFrenchDate(p.start_date) })
                    : ''}{' '}
                  · {t('programs.weeks', { count: p.duration_weeks })}
                </Text>
              </VStack>
              <HStack gap="xs">
                <Badge
                  label={t(`enums.programStatus.${p.status}`)}
                  tone={p.status === 'active' ? 'success' : 'neutral'}
                />
                <Button
                  variant="secondary"
                  label={t('adherent.openProgram')}
                  onPress={() => router.push(`/coach/programs/${p.id}`)}
                />
              </HStack>
            </HStack>
          ))}
          <Button
            variant="ghost"
            icon="send-outline"
            label={t('adherent.assignProgram')}
            onPress={() => router.push('/coach/programs')}
          />
        </VStack>
      </Card>
      <LineChartCard
        title={t('adherent.weightTrend')}
        icon="scale"
        color={theme.accent.progress}
        unit="kg"
        points={trend.map((p) => ({ label: formatShortDate(p.date), value: p.kg }))}
        points2={trend.map((p) => ({ label: formatShortDate(p.date), value: p.trend }))}
        emptyText={t('adherent.noData')}
      />
    </VStack>
  );
}

// ---------------------------------------------------------------------------
function effortText(s: Tables<'set_logs'>): string {
  if (s.rir !== null) return ` · RIR ${formatNumber(Number(s.rir))}`;
  if (s.rpe !== null) return ` · RPE ${formatNumber(Number(s.rpe))}`;
  return '';
}

function SessionCard({ s, names }: { s: SessionWithSets; names: Map<string, string> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const byExercise = new Map<string, Tables<'set_logs'>[]>();
  for (const set of s.sets)
    byExercise.set(set.exercise_id, [...(byExercise.get(set.exercise_id) ?? []), set]);
  return (
    <Card>
      <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)}>
        <HStack justify="space-between" wrap>
          <VStack gap="xxs" flex={1}>
            <Text weight="700">
              {s.workout?.name ?? '—'} · {formatLongDate(s.started_at.slice(0, 10))}
            </Text>
            <Text variant="small" color="textMuted">
              {formatTime(s.started_at)}
              {s.duration_seconds ? ` · ${formatDuration(s.duration_seconds)}` : ''}
              {` · ${s.sets.filter((x) => x.completed && x.set_type !== 'warmup').length} séries`}
            </Text>
          </VStack>
          <HStack gap="xs">
            {s.status !== 'completed' ? (
              <Badge
                label={
                  s.status === 'in_progress' ? t('adherent.inProgress') : t('adherent.abandoned')
                }
                tone="warning"
              />
            ) : null}
            {s.rating ? (
              <Badge
                label={t('adherent.sessionRating', { value: s.rating })}
                tone={s.rating >= 9 ? 'warning' : 'neutral'}
              />
            ) : null}
            <Icon name={open ? 'chevron-up' : 'chevron-down'} color="textMuted" />
          </HStack>
        </HStack>
      </Pressable>
      {open ? (
        <VStack gap="md" style={{ marginTop: theme.spacing.md }}>
          {s.notes ? <Text color="textMuted">« {s.notes} »</Text> : null}
          {[...byExercise.entries()].map(([exerciseId, sets]) => (
            <VStack key={exerciseId} gap="xxs">
              <Text weight="600">{names.get(exerciseId) ?? '—'}</Text>
              {sets.map((x, i) => (
                <Text
                  key={x.id}
                  variant="small"
                  color={x.completed ? 'textMuted' : 'danger'}
                  tabular
                >
                  {x.set_type === 'warmup' ? 'Échauf.' : `${i + 1}.`}{' '}
                  {x.load_kg !== null ? `${formatKg(Number(x.load_kg))} × ` : ''}
                  {x.reps ?? (x.duration_seconds ? formatDuration(x.duration_seconds) : '—')}
                  {effortText(x)}
                  {x.rest_seconds_actual !== null
                    ? ` · ${t('adherent.restVs', {
                        actual: formatDuration(x.rest_seconds_actual),
                        planned: x.rest_seconds_prescribed
                          ? formatDuration(x.rest_seconds_prescribed)
                          : '—',
                      })}`
                    : ''}
                  {x.completed ? '' : ` · ${t('adherent.failedSet')}`}
                  {x.note ? ` · « ${x.note} »` : ''}
                </Text>
              ))}
            </VStack>
          ))}
        </VStack>
      ) : null}
    </Card>
  );
}

export function SessionsTab({ adherentId }: { adherentId: string }) {
  const { t } = useTranslation();
  const sessions = useAdherentSessions(adherentId);
  const { data: exercises = [] } = useExercises();
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);
  if (sessions.isLoading) return <LoadingState />;
  if ((sessions.data ?? []).length === 0)
    return <EmptyState icon="barbell-outline" title={t('adherent.noSessions')} />;
  return (
    <VStack gap="sm">
      {(sessions.data ?? []).map((s) => (
        <SessionCard key={s.id} s={s} names={names} />
      ))}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
export function ProgressTab({ adherentId }: { adherentId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const sessions = useAdherentSessions(adherentId);
  const { data: exercises = [] } = useExercises();
  const names = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);
  const completed = (sessions.data ?? []).filter((s) => s.status === 'completed');
  // Exercices pratiqués, du plus fréquent au moins fréquent.
  const counts = new Map<string, number>();
  for (const s of completed)
    for (const id of new Set(s.sets.map((x) => x.exercise_id)))
      counts.set(id, (counts.get(id) ?? 0) + 1);
  const options = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => ({ value: id, label: names.get(id) ?? '—' }));
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const selected = exerciseId ?? options[0]?.value ?? null;

  if (sessions.isLoading) return <LoadingState />;
  if (!selected) return <EmptyState icon="stats-chart-outline" title={t('adherent.noData')} />;

  const history: ExerciseSession[] = completed
    .map((s) => ({
      sessionId: s.id,
      date: s.started_at.slice(0, 10),
      sets: s.sets.filter((x) => x.exercise_id === selected).map((x) => toLoggedSet(x)),
    }))
    .filter((h) => h.sets.length > 0);
  const progress = exerciseProgress(history);
  const series = (key: 'maxLoad' | 'estimated1RM' | 'volume') =>
    progress
      .filter((p) => p[key] !== null)
      .map((p) => ({
        label: formatShortDate(p.date),
        value: Math.round((p[key] as number) * 10) / 10,
      }));

  return (
    <VStack gap="lg">
      <SelectMenu
        label={t('adherent.chooseExercise')}
        value={selected}
        options={options}
        onChange={setExerciseId}
      />
      <LineChartCard
        title={t('adherent.maxLoad')}
        icon="barbell"
        color={theme.accent.training}
        unit="kg"
        points={series('maxLoad')}
        emptyText={t('adherent.noData')}
      />
      <LineChartCard
        title={t('adherent.e1rm')}
        icon="flash"
        color={theme.accent.records}
        unit="kg"
        points={series('estimated1RM')}
        emptyText={t('adherent.noData')}
      />
      <LineChartCard
        title={t('adherent.volume')}
        icon="layers"
        color={theme.accent.program}
        unit="kg"
        points={series('volume')}
        emptyText={t('adherent.noData')}
      />
    </VStack>
  );
}

// ---------------------------------------------------------------------------
export function RecordsTab({ adherentId }: { adherentId: string }) {
  const { t } = useTranslation();
  const records = useAdherentRecords(adherentId);
  if (records.isLoading) return <LoadingState />;
  if ((records.data ?? []).length === 0)
    return <EmptyState icon="trophy-outline" title={t('adherent.noRecords')} />;
  return (
    <VStack gap="sm">
      {(records.data ?? []).map((r) => (
        <Card key={r.id}>
          <HStack justify="space-between" wrap>
            <HStack gap="sm">
              <Icon name="trophy" color="highlight" />
              <VStack gap="xxs">
                <Text weight="700">{(r.exercise as { name: string } | null)?.name ?? '—'}</Text>
                <Text variant="small" color="textMuted">
                  {t(`training.recordTypes.${r.record_type}`, {
                    value: formatNumber(Number(r.value)),
                    load: r.load_kg !== null ? formatNumber(Number(r.load_kg)) : '',
                  })}
                </Text>
              </VStack>
            </HStack>
            <Text variant="small" color="textSubtle">
              {formatFrenchDate(r.achieved_at.slice(0, 10))}
            </Text>
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
function CheckinPhoto({ path }: { path: string }) {
  const theme = useTheme();
  const url = useSignedUrl('checkin-photos', path);
  return (
    <View
      style={{
        width: 96,
        height: 128,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      {url.data ? (
        <Image
          source={{ uri: url.data }}
          style={{ flex: 1 }}
          contentFit="cover"
          accessibilityLabel="Photo de progression"
        />
      ) : null}
    </View>
  );
}

function CheckinCard({ c, adherentId }: { c: Tables<'checkins'>; adherentId: string }) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const { replyCheckin } = useAdherentActions(adherentId);
  const [reply, setReply] = useState('');
  const score = (label: string, v: number | null) =>
    v === null ? null : <Badge label={`${label} ${v}/5`} />;
  return (
    <Card>
      <VStack gap="sm">
        <HStack justify="space-between" wrap>
          <Text weight="700">
            {t('adherent.checkinWeek', { date: formatFrenchDate(c.week_start) })}
          </Text>
          {c.weight_kg !== null ? <Text weight="700">{formatKg(Number(c.weight_kg))}</Text> : null}
        </HStack>
        <HStack gap="xs" wrap>
          {score(t('adherent.sleep'), c.sleep)}
          {score(t('adherent.energy'), c.energy)}
          {score(t('adherent.stress'), c.stress)}
          {score(t('adherent.soreness'), c.soreness)}
          {c.waist_cm !== null ? (
            <Badge label={`${t('adherent.waist')} ${formatNumber(Number(c.waist_cm))} cm`} />
          ) : null}
        </HStack>
        {c.comment ? <Text>« {c.comment} »</Text> : null}
        {c.photo_paths.length ? (
          <HStack gap="sm" wrap>
            {c.photo_paths.map((p) => (
              <CheckinPhoto key={p} path={p} />
            ))}
          </HStack>
        ) : null}
        {c.coach_reply ? (
          <Card>
            <Text variant="caption" color="textSubtle">
              {t('adherent.yourReply')}
            </Text>
            <Text>{c.coach_reply}</Text>
          </Card>
        ) : (
          <VStack gap="xs">
            <TextField
              placeholder={t('adherent.replyPlaceholder')}
              value={reply}
              onChangeText={setReply}
              multiline
            />
            <Button
              icon="send"
              label={t('adherent.reply')}
              disabled={reply.trim() === ''}
              loading={replyCheckin.isPending}
              onPress={() =>
                replyCheckin.mutate(
                  { checkinId: c.id, reply: reply.trim() },
                  {
                    onSuccess: () => toast(t('adherent.replied')),
                    onError: (e) => toast(toUserMessage(e)),
                  },
                )
              }
              style={{ alignSelf: 'flex-start' }}
            />
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

export function CheckinsTab({ adherentId }: { adherentId: string }) {
  const { t } = useTranslation();
  const checkins = useAdherentCheckins(adherentId);
  if (checkins.isLoading) return <LoadingState />;
  if ((checkins.data ?? []).length === 0)
    return <EmptyState icon="clipboard-outline" title={t('adherent.noCheckins')} />;
  return (
    <VStack gap="sm">
      {(checkins.data ?? []).map((c) => (
        <CheckinCard key={c.id} c={c} adherentId={adherentId} />
      ))}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
export function NotesTab({ adherentId }: { adherentId: string }) {
  const { t } = useTranslation();
  const notes = useCoachNotes(adherentId);
  const { addNote, deleteNote } = useAdherentActions(adherentId);
  const [text, setText] = useState('');
  return (
    <VStack gap="md">
      <HStack gap="xs">
        <Icon name="lock-closed-outline" size={16} color="textMuted" />
        <Text variant="small" color="textMuted">
          {t('adherent.notesPrivate')}
        </Text>
      </HStack>
      <TextField
        placeholder={t('adherent.notePlaceholder')}
        value={text}
        onChangeText={setText}
        multiline
      />
      <Button
        icon="add"
        label={t('adherent.addNote')}
        disabled={text.trim() === ''}
        loading={addNote.isPending}
        onPress={() => addNote.mutate(text.trim(), { onSuccess: () => setText('') })}
        style={{ alignSelf: 'flex-start' }}
      />
      {(notes.data ?? []).length === 0 ? (
        <Text color="textMuted">{t('adherent.noNotes')}</Text>
      ) : null}
      {(notes.data ?? []).map((n) => (
        <Card key={n.id}>
          <HStack align="flex-start">
            <VStack gap="xxs" flex={1}>
              <Text>{n.body}</Text>
              <Text variant="caption" color="textSubtle">
                {formatFrenchDate(n.created_at.slice(0, 10))}
              </Text>
            </VStack>
            <IconButton
              icon="trash-outline"
              label={t('common.delete')}
              color="textMuted"
              onPress={() => deleteNote.mutate(n.id)}
            />
          </HStack>
        </Card>
      ))}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
export function SettingsTab({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const refs = useReference1rm(profile.id);
  const { updateProfile, set1rm } = useAdherentActions(profile.id);
  const [picker, setPicker] = useState(false);
  const save = (patch: Parameters<typeof updateProfile.mutate>[0]) =>
    updateProfile.mutate(patch, {
      onSuccess: () => toast(t('adherent.saved')),
      onError: (e) => toast(toUserMessage(e)),
    });

  return (
    <VStack gap="lg">
      <Card>
        <VStack gap="md">
          <Text weight="700">{t('adherent.effortScale')}</Text>
          <Segmented
            options={[
              { value: 'rir' as const, label: t('enums.effortScale.rir') },
              { value: 'rpe' as const, label: t('enums.effortScale.rpe') },
            ]}
            value={profile.effort_scale}
            onChange={(v) => save({ effort_scale: v })}
          />
          <Text weight="700">{t('adherent.checkinDay')}</Text>
          <SelectMenu
            label={t('adherent.checkinDay')}
            value={profile.checkin_weekday ?? 0}
            options={[
              { value: 0, label: t('adherent.defaultDay') },
              ...[1, 2, 3, 4, 5, 6, 7].map((d) => ({
                value: d,
                label: t(`enums.weekday.${d}` as 'enums.weekday.1'),
              })),
            ]}
            onChange={(v) => save({ checkin_weekday: v === 0 ? null : v })}
          />
        </VStack>
      </Card>

      <Card>
        <VStack gap="sm">
          <Text weight="700">{t('adherent.reference1rm')}</Text>
          {(refs.data ?? []).map((r) => (
            <HStack key={r.exercise_id} justify="space-between">
              <Text style={{ flex: 1 }}>
                {(r.exercise as { name: string } | null)?.name ?? '—'}
              </Text>
              <NumberCell
                label={t('adherent.value1rm')}
                value={Number(r.value_kg)}
                width={80}
                max={1000}
                onCommit={(v) => set1rm.mutate({ exerciseId: r.exercise_id, value: v })}
              />
              <IconButton
                icon="trash-outline"
                label={t('common.delete')}
                color="textMuted"
                onPress={() => set1rm.mutate({ exerciseId: r.exercise_id, value: null })}
              />
            </HStack>
          ))}
          <Button
            variant="secondary"
            icon="add"
            label={t('adherent.add1rm')}
            onPress={() => setPicker(true)}
            style={{ alignSelf: 'flex-start' }}
          />
        </VStack>
      </Card>

      <Card>
        <VStack gap="sm">
          <Text weight="700">{t('adherent.access')}</Text>
          {profile.is_active ? (
            <Button
              variant="danger"
              icon="lock-closed-outline"
              label={t('adherent.deactivate')}
              onPress={async () => {
                const ok = await confirm({
                  title: t('adherent.deactivate'),
                  message: t('adherent.deactivateConfirm'),
                  destructive: true,
                  confirmLabel: t('adherent.deactivate'),
                });
                if (ok) save({ is_active: false });
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : (
            <Button
              icon="lock-open-outline"
              label={t('adherent.reactivate')}
              onPress={() => save({ is_active: true })}
              style={{ alignSelf: 'flex-start' }}
            />
          )}
        </VStack>
      </Card>

      <VStack gap="xs">
        <Text weight="700">{t('settings.adherentOverride')}</Text>
        <Text variant="small" color="textMuted">
          {t('settings.rulesHelp')}
        </Text>
        <RuleEditor adherentId={profile.id} />
      </VStack>

      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(exerciseId) => set1rm.mutate({ exerciseId, value: 100 })}
        excludeIds={(refs.data ?? []).map((r) => r.exercise_id)}
      />
    </VStack>
  );
}
