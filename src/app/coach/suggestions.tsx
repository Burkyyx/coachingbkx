import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  Avatar,
  Checkbox,
  EmptyState,
  ErrorState,
  HStack,
  LoadingState,
  NumberCell,
  Screen,
  Segmented,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import {
  adjustMacrosForKcal,
  formatInt,
  formatKg,
  formatNumber,
  formatRelative,
  formatRepRange,
  repsTargetHint,
} from '@/core';
import {
  fullName,
  useSuggestionActions,
  useSuggestions,
  type SuggestionRow,
} from '@/features/coach/api';
import { toUserMessage } from '@/lib/errors';

type Values = Record<string, unknown>;
const num = (v: unknown) =>
  typeof v === 'number' ? v : v === null || v === undefined ? null : Number(v);

/** Résumé lisible « actuel → proposé ». */
function useDescribe() {
  const { t } = useTranslation();
  return (s: SuggestionRow, value: Values = s.proposed_value as Values): string | null => {
    const cur = s.current_value as Values;
    switch (s.kind) {
      case 'load':
        return `${formatKg(num(cur.load_kg) ?? 0)} → ${formatKg(num(value.load_kg) ?? 0)}`;
      case 'rep_range':
        return `${formatRepRange(num(cur.reps_min), num(cur.reps_max))} → ${formatRepRange(num(value.reps_min), num(value.reps_max))} reps`;
      case 'deload':
        return `${t('suggestions.weekLabel', { n: num(value.week_index) ?? '?' })} : ${t('suggestions.volume', { factor: formatNumber(num(value.volume_factor) ?? 0.5) })}`;
      case 'variation':
        return `${String(cur.exercise_name ?? '')} → ${String(value.exercise_name ?? '')}`;
      case 'reps_target':
        return num(value.reps) !== null
          ? t('suggestions.repsTargetSummary', {
              from: num(cur.reps) ?? '?',
              to: num(value.reps) ?? '?',
              load: num(value.load_kg) ? ` à ${formatKg(num(value.load_kg) ?? 0)}` : '',
            })
          : typeof value.hint === 'string'
            ? value.hint
            : null;
      case 'calories':
        return t('suggestions.caloriesSummary', {
          from: formatInt(num(cur.kcal) ?? 0),
          to: formatInt(num(value.kcal) ?? 0),
          carbsFrom: formatInt(num(cur.carbs_g) ?? 0),
          carbsTo: formatInt(num(value.carbs_g) ?? 0),
        });
      default:
        return null;
    }
  };
}

/** Calories modifiées par le coach : seuls les glucides absorbent la différence. */
function caloriesValue(s: SuggestionRow, kcal: number): Values {
  const cur = s.current_value as Values;
  const m = adjustMacrosForKcal(
    {
      kcal: num(cur.kcal) ?? 0,
      proteinG: num(cur.protein_g) ?? 0,
      carbsG: num(cur.carbs_g) ?? 0,
      fatG: num(cur.fat_g) ?? 0,
    },
    Math.round(kcal),
  );
  return { kcal: m.kcal, protein_g: m.proteinG, carbs_g: m.carbsG, fat_g: m.fatG };
}

/** Éditeur de la valeur proposée (bouton « Modifier »). */
function ModifyEditor({
  s,
  onApply,
  onCancel,
}: {
  s: SuggestionRow;
  onApply: (v: Values) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const proposed = s.proposed_value as Values;
  const [value, setValue] = useState<Values>({ ...proposed });
  const cell = (key: string, label: string, decimals = 2, max = 1000) => (
    <NumberCell
      label={label}
      showLabel
      value={num(value[key])}
      decimals={decimals}
      max={max}
      width={90}
      onCommit={(v) => setValue((x) => ({ ...x, [key]: v }))}
    />
  );
  return (
    <VStack gap="sm">
      <HStack gap="sm" wrap align="flex-end">
        {s.kind === 'load' ? cell('load_kg', 'kg') : null}
        {s.kind === 'reps_target' ? cell('reps', t('suggestions.targetReps'), 0, 100) : null}
        {s.kind === 'rep_range' ? (
          <>
            {cell('reps_min', 'Reps min', 0, 100)}
            {cell('reps_max', 'Reps max', 0, 100)}
          </>
        ) : null}
        {s.kind === 'deload'
          ? cell('volume_factor', t('settings.params.volumeFactor'), 2, 1)
          : null}
        {s.kind === 'calories' ? cell('kcal', t('suggestions.kcalPerDay'), 0, 8000) : null}
      </HStack>
      <HStack gap="sm">
        <Button
          label={t('suggestions.applyModified')}
          onPress={() =>
            onApply(
              // Le message affiché à l'adhérent suit l'objectif modifié.
              s.kind === 'reps_target' && num(value.reps) !== null
                ? { ...value, hint: repsTargetHint(num(value.reps) ?? 0, num(value.load_kg)) }
                : s.kind === 'calories'
                  ? caloriesValue(s, num(value.kcal) ?? 0)
                  : value,
            )
          }
        />
        <Button variant="ghost" label={t('common.cancel')} onPress={onCancel} />
      </HStack>
    </VStack>
  );
}

export default function SuggestionsScreen() {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const [tab, setTab] = useState<'pending' | 'decided'>('pending');
  const list = useSuggestions(tab);
  const actions = useSuggestionActions();
  const describe = useDescribe();
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async <T,>(fn: () => Promise<T>, message: string | ((result: T) => string)) => {
    setBusy(true);
    try {
      const result = await fn();
      toast(typeof message === 'string' ? message : message(result));
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Message après application : dit précisément ce qui a changé (ou que rien n'a changé). */
  const appliedMessage =
    (kind: SuggestionRow['kind']) =>
    (count: number): string => {
      if (kind === 'info') return t('suggestions.acknowledged');
      if (count === 0) return t('suggestions.appliedNothing');
      if (kind === 'reps_target') return t('suggestions.appliedRepsTarget');
      if (kind === 'load' || kind === 'rep_range') return t('suggestions.appliedSets', { count });
      if (kind === 'variation') return t('suggestions.appliedExercises', { count });
      if (kind === 'calories') return t('suggestions.appliedCalories');
      return t('suggestions.accepted');
    };

  const rows = list.data ?? [];
  const acceptMany = () =>
    run(
      async () => {
        for (const id of selected) await actions.accept(id);
        setSelected([]);
      },
      t('suggestions.acceptedMany', { count: selected.length }),
    );

  return (
    <Screen maxWidth={1000} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      <VStack gap="xxs">
        <Text variant="headline" accessibilityRole="header">
          {t('suggestions.title')}
        </Text>
        <Text color="textMuted">{t('suggestions.subtitle')}</Text>
        <Text variant="small" color="textSubtle">
          {t('suggestions.scopeNote')}
        </Text>
      </VStack>
      <Segmented
        options={[
          { value: 'pending' as const, label: t('suggestions.pending') },
          { value: 'decided' as const, label: t('suggestions.history') },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelected([]);
        }}
      />

      {tab === 'pending' && rows.length > 0 ? (
        <HStack gap="sm" wrap>
          <Button
            variant="ghost"
            icon="checkbox-outline"
            label={t('suggestions.selectAll')}
            onPress={() =>
              setSelected(selected.length === rows.length ? [] : rows.map((r) => r.id))
            }
          />
          <Button
            icon="checkmark-done"
            label={t('suggestions.acceptSelected', { count: selected.length })}
            disabled={selected.length === 0 || busy}
            onPress={() => void acceptMany()}
          />
          <Button
            variant="danger"
            label={t('suggestions.rejectSelected')}
            disabled={selected.length === 0 || busy}
            onPress={() =>
              void run(async () => {
                await actions.reject(selected);
                setSelected([]);
              }, t('suggestions.rejected'))
            }
          />
        </HStack>
      ) : null}

      {list.isLoading ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="sparkles-outline"
          title={tab === 'pending' ? t('suggestions.empty') : t('suggestions.emptyHistory')}
        />
      ) : (
        rows.map((s) => {
          const summary = describe(s, (s.final_value ?? s.proposed_value) as Values);
          const applied = ['accepted', 'modified', 'auto_applied'].includes(s.status);
          return (
            <Card key={s.id}>
              <VStack gap="sm">
                <HStack gap="sm" wrap>
                  <Avatar
                    id={s.adherent_id}
                    name={s.adherent ? fullName(s.adherent) : '?'}
                    size={30}
                  />
                  {tab === 'pending' ? (
                    <Checkbox
                      label={s.adherent ? fullName(s.adherent) : '—'}
                      checked={selected.includes(s.id)}
                      onChange={(v) =>
                        setSelected((x) => (v ? [...x, s.id] : x.filter((id) => id !== s.id)))
                      }
                    />
                  ) : (
                    <Text weight="700">{s.adherent ? fullName(s.adherent) : '—'}</Text>
                  )}
                  <Badge tone="info" label={t(`suggestions.kinds.${s.kind}`)} />
                  {s.exercise ? <Badge label={s.exercise.name} /> : null}
                  {tab === 'decided' ? (
                    <Badge
                      label={t(`suggestions.statuses.${s.status}`)}
                      tone={
                        s.status === 'rejected' || s.status === 'reverted' ? 'neutral' : 'success'
                      }
                    />
                  ) : null}
                  <Text variant="caption" color="textSubtle">
                    {formatRelative(s.decided_at ?? s.created_at)}
                  </Text>
                </HStack>
                <Text>{s.justification}</Text>
                {summary ? (
                  <Text weight="700" tabular>
                    {summary}
                  </Text>
                ) : null}

                {tab === 'pending' && editing === s.id ? (
                  <ModifyEditor
                    s={s}
                    onCancel={() => setEditing(null)}
                    onApply={(v) =>
                      void run(async () => {
                        const n = await actions.accept(s.id, v);
                        setEditing(null);
                        return n;
                      }, appliedMessage(s.kind))
                    }
                  />
                ) : tab === 'pending' ? (
                  <HStack gap="sm" wrap>
                    <Button
                      icon="checkmark"
                      label={
                        s.kind === 'info' ? t('suggestions.acknowledge') : t('suggestions.accept')
                      }
                      disabled={busy}
                      onPress={() => void run(() => actions.accept(s.id), appliedMessage(s.kind))}
                    />
                    {['load', 'rep_range', 'deload', 'reps_target', 'calories'].includes(s.kind) ? (
                      <Button
                        variant="secondary"
                        icon="create-outline"
                        label={t('suggestions.modify')}
                        onPress={() => setEditing(s.id)}
                      />
                    ) : null}
                    <Button
                      variant="ghost"
                      icon="close"
                      label={t('suggestions.reject')}
                      disabled={busy}
                      onPress={() =>
                        void run(() => actions.reject([s.id]), t('suggestions.rejected'))
                      }
                    />
                    <Button
                      variant="ghost"
                      label={t('nav.adherents')}
                      onPress={() => router.push(`/coach/adherents/${s.adherent_id}`)}
                    />
                  </HStack>
                ) : applied && s.kind !== 'info' ? (
                  <Button
                    variant="secondary"
                    icon="arrow-undo"
                    label={t('suggestions.revert')}
                    disabled={busy}
                    onPress={() => void run(() => actions.revert(s.id), t('suggestions.reverted'))}
                    style={{ alignSelf: 'flex-start' }}
                  />
                ) : null}
              </VStack>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
