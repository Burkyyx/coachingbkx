import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Button,
  Checkbox,
  HStack,
  Segmented,
  Sheet,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import { addDays, formatFrenchDate, maskFrenchDate, parseFrenchDate, todayLocal } from '@/core';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { useExercises } from '@/features/exercises/api';
import { toUserMessage } from '@/lib/errors';

import { useChallengeActions, type Challenge } from './progress';

const METRICS = ['sessions', 'streak_weeks', 'volume', 'reps'] as const;
type Metric = (typeof METRICS)[number];

function num(text: string): number | null {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) ? null : n;
}

/** Création / modification d'un challenge (uniquement effort et régularité). */
export function ChallengeEditor({
  challenge,
  onClose,
}: {
  challenge: Challenge | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const { save } = useChallengeActions(null);
  const { data: exercises = [] } = useExercises();
  const today = todayLocal();

  const [title, setTitle] = useState(challenge?.title ?? '');
  const [description, setDescription] = useState(challenge?.description ?? '');
  const [metric, setMetric] = useState<Metric>(challenge?.metric ?? 'sessions');
  const [exerciseId, setExerciseId] = useState<string | null>(challenge?.exercise_id ?? null);
  const [target, setTarget] = useState(challenge ? String(Number(challenge.target)) : '12');
  const [collective, setCollective] = useState(challenge?.collective ?? false);
  const [from, setFrom] = useState(formatFrenchDate(challenge?.starts_on ?? today));
  const [to, setTo] = useState(formatFrenchDate(challenge?.ends_on ?? addDays(today, 27)));
  const [leaderboard, setLeaderboard] = useState(challenge?.leaderboard ?? false);
  const [xp, setXp] = useState(String(challenge?.xp_reward ?? 50));
  const [reward, setReward] = useState(challenge?.real_reward ?? '');
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exerciseName = exercises.find((e) => e.id === exerciseId)?.name;
  const withExercise = metric === 'volume' || metric === 'reps';

  const submit = () => {
    setError(null);
    const start = parseFrenchDate(from);
    const end = parseFrenchDate(to);
    const goal = num(target);
    const xpReward = num(xp);
    if (title.trim().length < 2) return setError(t('community.coach.errorTitle'));
    if (!start || !end || end < start) return setError(t('community.coach.errorDates'));
    if (goal === null || goal <= 0) return setError(t('community.coach.errorTarget'));
    if (xpReward === null || xpReward < 0 || xpReward > 500)
      return setError(t('community.coach.errorXp'));
    save.mutate(
      {
        ...(challenge ? { id: challenge.id } : {}),
        title: title.trim(),
        description: description.trim() || null,
        metric,
        exercise_id: withExercise ? exerciseId : null,
        target: goal,
        collective: metric === 'streak_weeks' ? false : collective,
        starts_on: start,
        ends_on: end,
        leaderboard,
        xp_reward: Math.round(xpReward),
        real_reward: reward.trim() || null,
      },
      {
        onSuccess: () => {
          toast(t('community.coach.challengeSaved'));
          onClose();
        },
        onError: (e) => setError(toUserMessage(e)),
      },
    );
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={challenge ? t('community.coach.editChallenge') : t('community.coach.newChallenge')}
      footer={
        <VStack gap="xs">
          {error ? <Text color="danger">{error}</Text> : null}
          <Button
            icon="checkmark"
            label={t('common.save')}
            loading={save.isPending}
            onPress={submit}
          />
        </VStack>
      }
    >
      <TextField
        label={t('community.coach.title')}
        placeholder={t('community.coach.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        maxLength={80}
      />
      <TextField
        label={`${t('community.coach.description')} (${t('common.optional')})`}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />
      <VStack gap="xs">
        <Text variant="small" weight="600" color="textMuted">
          {t('community.coach.metric')}
        </Text>
        <Segmented
          scrollable
          options={METRICS.map((m) => ({ value: m, label: t(`community.coach.metrics.${m}`) }))}
          value={metric}
          onChange={setMetric}
        />
        <Text variant="caption" color="textSubtle">
          {t(`community.coach.metricHelp.${metric}`)}
        </Text>
      </VStack>
      {withExercise ? (
        <HStack gap="sm" wrap>
          <Button
            variant="secondary"
            icon="barbell-outline"
            label={exerciseName ?? t('community.coach.allExercises')}
            onPress={() => setPicker(true)}
          />
          {exerciseId ? (
            <Button
              variant="ghost"
              label={t('community.coach.allExercises')}
              onPress={() => setExerciseId(null)}
            />
          ) : null}
        </HStack>
      ) : null}
      <HStack gap="sm" align="flex-start" wrap>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField
            label={t('community.coach.target')}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            inputMode="decimal"
          />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField
            label={t('community.coach.from')}
            value={from}
            onChangeText={(v) => setFrom((p) => maskFrenchDate(v, p))}
            placeholder="JJ/MM/AAAA"
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField
            label={t('community.coach.to')}
            value={to}
            onChangeText={(v) => setTo((p) => maskFrenchDate(v, p))}
            placeholder="JJ/MM/AAAA"
            keyboardType="number-pad"
          />
        </View>
      </HStack>
      {metric !== 'streak_weeks' ? (
        <Checkbox
          checked={collective}
          onChange={setCollective}
          label={t('community.coach.collective')}
          description={t('community.coach.collectiveHint')}
        />
      ) : null}
      <Checkbox
        checked={leaderboard}
        onChange={setLeaderboard}
        label={t('community.coach.leaderboard')}
        description={t('community.coach.leaderboardHint')}
      />
      <HStack gap="sm" align="flex-start" wrap>
        <View style={{ flex: 1, minWidth: 120 }}>
          <TextField
            label={t('community.coach.xpReward')}
            value={xp}
            onChangeText={setXp}
            keyboardType="number-pad"
            inputMode="numeric"
          />
        </View>
        <View style={{ flex: 2, minWidth: 180 }}>
          <TextField
            label={`${t('community.coach.realReward')} (${t('common.optional')})`}
            placeholder={t('community.coach.realRewardPlaceholder')}
            value={reward}
            onChangeText={setReward}
            maxLength={200}
          />
        </View>
      </HStack>
      <Text variant="caption" color="textSubtle">
        {t('community.coach.rules')}
      </Text>
      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(id) => setExerciseId(id)}
      />
    </Sheet>
  );
}
