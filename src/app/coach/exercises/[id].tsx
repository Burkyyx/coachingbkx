import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  Button,
  Card,
  ChipSelect,
  EmptyState,
  HStack,
  IconButton,
  ListRow,
  LoadingState,
  Screen,
  Segmented,
  Stepper,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  EQUIPMENTS,
  EXERCISE_TYPES,
  MUSCLES,
  defaultIncrement,
  useAlternatives,
  useArchiveExercise,
  useExercises,
  useSaveExercise,
  type Exercise,
} from '@/features/exercises/api';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { ExerciseVideo } from '@/features/exercises/ExerciseVideo';
import { toUserMessage } from '@/lib/errors';
import { extensionFor, removeFiles, uploadFile } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export default function ExerciseEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercises, isLoading } = useExercises();
  const { data: alternatives } = useAlternatives();
  const { t } = useTranslation();

  if (isLoading || !exercises || !alternatives) return <LoadingState />;
  const isNew = id === 'new';
  const exercise = exercises.find((e) => e.id === id) ?? null;
  if (!isNew && !exercise) {
    return (
      <Screen>
        <EmptyState
          title={t('common.notFound')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  return (
    <ExerciseForm
      key={id}
      exercise={exercise}
      allExercises={exercises}
      initialAlternatives={exercise ? (alternatives.get(exercise.id) ?? []) : []}
    />
  );
}

function ExerciseForm({
  exercise,
  allExercises,
  initialAlternatives,
}: {
  exercise: Exercise | null;
  allExercises: Exercise[];
  initialAlternatives: string[];
}) {
  const { t } = useTranslation();
  const { confirm, toast } = useFeedback();
  const save = useSaveExercise();
  const archive = useArchiveExercise();
  const [alts, setAlts] = useState<string[]>(initialAlternatives);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoPath, setVideoPath] = useState<string | null>(exercise?.video_path ?? null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t('common.required')).max(120),
        primary_muscle: z.enum(MUSCLES),
        secondary_muscles: z.array(z.enum(MUSCLES)),
        equipment: z.enum(EQUIPMENTS),
        type: z.enum(EXERCISE_TYPES),
        load_increment_kg: z.number().positive().max(50),
        instructions: z.string().max(4000),
        video_url: z
          .string()
          .trim()
          .refine((v) => v === '' || /^https:\/\//i.test(v), t('exercises.videoLink')),
      }),
    [t],
  );

  const { control, handleSubmit, formState, setValue } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: exercise?.name ?? '',
      primary_muscle: exercise?.primary_muscle ?? 'chest',
      secondary_muscles: exercise?.secondary_muscles ?? [],
      equipment: exercise?.equipment ?? 'barbell',
      type: exercise?.type ?? 'free_weight',
      load_increment_kg: exercise ? Number(exercise.load_increment_kg) : 2.5,
      instructions: exercise?.instructions ?? '',
      video_url: exercise?.video_url ?? '',
    },
  });

  const videoUrl = useWatch({ control, name: 'video_url' });
  const primaryMuscle = useWatch({ control, name: 'primary_muscle' });
  const equipment = useWatch({ control, name: 'equipment' });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const newId = await save.mutateAsync({
        id: exercise?.id ?? null,
        values: {
          ...v,
          instructions: v.instructions.trim() || null,
          video_url: v.video_url || null,
        },
        alternatives: alts,
      });
      toast(t('exercises.saved'));
      if (!exercise) router.replace(`/coach/exercises/${newId}`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === '23505' ? t('exercises.nameTaken') : toUserMessage(e));
    }
  });

  const uploadVideo = async () => {
    if (!exercise) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setUploading(true);
    setError(null);
    try {
      const mime = asset.mimeType ?? 'video/mp4';
      const path = `${exercise.id}/${Date.now()}.${extensionFor(mime)}`;
      await uploadFile('exercise-media', path, asset.uri, mime);
      const { error: updateError } = await supabase
        .from('exercises')
        .update({ video_path: path })
        .eq('id', exercise.id);
      if (updateError) throw updateError;
      if (videoPath) await removeFiles('exercise-media', [videoPath]).catch(() => undefined);
      setVideoPath(path);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const removeVideo = async () => {
    if (!exercise || !videoPath) return;
    await supabase.from('exercises').update({ video_path: null }).eq('id', exercise.id);
    await removeFiles('exercise-media', [videoPath]).catch(() => undefined);
    setVideoPath(null);
  };

  const toggleArchive = async () => {
    if (!exercise) return;
    if (!exercise.archived_at) {
      const ok = await confirm({
        title: t('common.archive'),
        message: t('exercises.archiveConfirm'),
        confirmLabel: t('common.archive'),
        destructive: true,
      });
      if (!ok) return;
    }
    await archive.mutateAsync({ id: exercise.id, archived: !exercise.archived_at });
    router.back();
  };

  const byId = new Map(allExercises.map((e) => [e.id, e]));
  const muscleOptions = MUSCLES.map((m) => ({ value: m, label: t(`enums.muscle.${m}`) }));

  return (
    <Screen maxWidth={860}>
      <HStack justify="space-between">
        <Button
          variant="ghost"
          icon="arrow-back"
          label={t('nav.exercises')}
          onPress={() => router.navigate('/coach/exercises')}
        />
        {exercise ? (
          <Button
            variant="ghost"
            icon={exercise.archived_at ? 'refresh' : 'archive-outline'}
            label={exercise.archived_at ? t('common.unarchive') : t('common.archive')}
            onPress={() => void toggleArchive()}
          />
        ) : null}
      </HStack>
      <Text variant="headline" accessibilityRole="header">
        {exercise ? t('exercises.edit') : t('exercises.new')}
      </Text>

      <Card>
        <VStack gap="lg">
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextField
                label={t('exercises.name')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={formState.errors.name?.message}
              />
            )}
          />
          <VStack gap="xs">
            <Text variant="small" weight="600" color="textMuted">
              {t('exercises.primaryMuscle')}
            </Text>
            <Controller
              control={control}
              name="primary_muscle"
              render={({ field }) => (
                <Segmented
                  options={muscleOptions}
                  value={field.value}
                  onChange={(m) => {
                    field.onChange(m);
                    if (!exercise) setValue('load_increment_kg', defaultIncrement(m, equipment));
                  }}
                />
              )}
            />
          </VStack>
          <VStack gap="xs">
            <Text variant="small" weight="600" color="textMuted">
              {t('exercises.secondaryMuscles')}
            </Text>
            <Controller
              control={control}
              name="secondary_muscles"
              render={({ field }) => (
                <ChipSelect
                  options={muscleOptions}
                  values={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </VStack>
          <VStack gap="xs">
            <Text variant="small" weight="600" color="textMuted">
              {t('exercises.equipment')}
            </Text>
            <Controller
              control={control}
              name="equipment"
              render={({ field }) => (
                <Segmented
                  options={EQUIPMENTS.map((e) => ({ value: e, label: t(`enums.equipment.${e}`) }))}
                  value={field.value}
                  onChange={(eq) => {
                    field.onChange(eq);
                    if (!exercise)
                      setValue('load_increment_kg', defaultIncrement(primaryMuscle, eq));
                  }}
                />
              )}
            />
          </VStack>
          <VStack gap="xs">
            <Text variant="small" weight="600" color="textMuted">
              {t('exercises.type')}
            </Text>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Segmented
                  options={EXERCISE_TYPES.map((x) => ({
                    value: x,
                    label: t(`enums.exerciseType.${x}`),
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </VStack>
          <VStack gap="xs">
            <Controller
              control={control}
              name="load_increment_kg"
              render={({ field }) => (
                <Stepper
                  label={t('exercises.increment')}
                  unit="kg"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0.5)}
                  step={0.5}
                  min={0.5}
                  max={50}
                  decimals={2}
                />
              )}
            />
            <Text variant="caption" color="textSubtle">
              {t('exercises.incrementHint')}
            </Text>
          </VStack>
          <Controller
            control={control}
            name="instructions"
            render={({ field }) => (
              <TextField
                label={t('exercises.instructions')}
                value={field.value}
                onChangeText={field.onChange}
                multiline
              />
            )}
          />
        </VStack>
      </Card>

      <Card>
        <VStack gap="md">
          <Text variant="subtitle">{t('exercises.video')}</Text>
          {exercise && videoPath ? <ExerciseVideo path={videoPath} url={null} /> : null}
          {!videoPath && videoUrl ? <ExerciseVideo path={null} url={videoUrl} /> : null}
          <Controller
            control={control}
            name="video_url"
            render={({ field }) => (
              <TextField
                label={t('exercises.videoLink')}
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                keyboardType="url"
                error={formState.errors.video_url?.message}
              />
            )}
          />
          {exercise ? (
            <HStack gap="sm" wrap>
              <Button
                variant="secondary"
                icon="cloud-upload-outline"
                label={
                  uploading
                    ? t('exercises.videoUploading')
                    : videoPath
                      ? t('exercises.videoReplace')
                      : t('exercises.videoUpload')
                }
                loading={uploading}
                onPress={() => void uploadVideo()}
              />
              {videoPath ? (
                <Button
                  variant="danger"
                  label={t('exercises.videoRemove')}
                  onPress={() => void removeVideo()}
                />
              ) : null}
            </HStack>
          ) : null}
        </VStack>
      </Card>

      <Card>
        <VStack gap="sm">
          <Text variant="subtitle">{t('exercises.alternatives')}</Text>
          <Text variant="small" color="textMuted">
            {t('exercises.alternativesHint')}
          </Text>
          {alts.map((altId) => (
            <ListRow
              key={altId}
              title={byId.get(altId)?.name ?? '—'}
              icon="swap-horizontal"
              right={
                <IconButton
                  icon="close"
                  label={t('common.delete')}
                  onPress={() => setAlts((a) => a.filter((x) => x !== altId))}
                />
              }
            />
          ))}
          <Button
            variant="secondary"
            icon="add"
            label={t('exercises.addAlternative')}
            onPress={() => setPickerOpen(true)}
          />
        </VStack>
      </Card>

      {error ? <Text color="danger">{error}</Text> : null}
      <Button
        label={t('common.save')}
        size="lg"
        loading={save.isPending}
        onPress={() => void onSubmit()}
      />

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        excludeIds={[...alts, ...(exercise ? [exercise.id] : [])]}
        onPickMany={(ids) => setAlts((a) => [...a, ...ids])}
      />
    </Screen>
  );
}
