import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  HStack,
  NumberCell,
  SelectMenu,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { DEFAULT_PARAMS, resolveRule, type RuleKey, type RuleRow } from '@/core';
import { toUserMessage } from '@/lib/errors';
import { supabase, type Json } from '@/lib/supabase';

const RULES: RuleKey[] = ['double_progression', 'stagnation', 'fatigue', 'rest_time'];

/** Toutes les lignes de règles (pour calculer les valeurs effectives). */
function useRuleRows() {
  return useQuery({
    queryKey: ['coach', 'rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('progression_rules').select('*');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Réglage des algorithmes de suggestion :
 *  - portée globale (adherentId et exerciseId absents) ;
 *  - ou surcharge pour un adhérent et/ou un exercice.
 */
export function RuleEditor({
  adherentId = null,
  exerciseId = null,
  only,
}: {
  adherentId?: string | null;
  exerciseId?: string | null;
  only?: RuleKey[];
}) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  const rows = useRuleRows();
  const scoped = adherentId !== null || exerciseId !== null;

  const save = useMutation({
    mutationFn: async (args: {
      ruleKey: RuleKey;
      params: Record<string, unknown>;
      enabled: boolean;
      autoApply: boolean;
    }) => {
      const existing = rows.data?.find(
        (r) =>
          r.rule_key === args.ruleKey &&
          r.adherent_id === adherentId &&
          r.exercise_id === exerciseId,
      );
      const payload = {
        rule_key: args.ruleKey,
        adherent_id: adherentId,
        exercise_id: exerciseId,
        params: args.params as { [key: string]: Json },
        enabled: args.enabled,
        auto_apply: args.autoApply,
      };
      const { error } = existing
        ? await supabase.from('progression_rules').update(payload).eq('id', existing.id)
        : await supabase.from('progression_rules').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast(t('settings.saved'));
      void qc.invalidateQueries({ queryKey: ['coach', 'rules'] });
    },
    onError: (e) => toast(toUserMessage(e)),
  });
  const reset = useMutation({
    mutationFn: async (ruleKey: RuleKey) => {
      let q = supabase.from('progression_rules').delete().eq('rule_key', ruleKey);
      q = adherentId ? q.eq('adherent_id', adherentId) : q.is('adherent_id', null);
      q = exerciseId ? q.eq('exercise_id', exerciseId) : q.is('exercise_id', null);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coach', 'rules'] }),
  });

  if (!rows.data) return null;
  const ruleRows: RuleRow[] = rows.data.map((r) => ({
    ruleKey: r.rule_key as RuleKey,
    adherentId: r.adherent_id,
    exerciseId: r.exercise_id,
    params: (r.params ?? {}) as Record<string, unknown>,
    enabled: r.enabled,
    autoApply: r.auto_apply,
  }));

  return (
    <VStack gap="md">
      {(only ?? RULES).map((ruleKey) => {
        const own = rows.data.find(
          (r) =>
            r.rule_key === ruleKey && r.adherent_id === adherentId && r.exercise_id === exerciseId,
        );
        const effective = resolveRule(ruleKey, ruleRows, adherentId ?? '__global__', exerciseId);
        const params = effective.params as Record<string, unknown>;
        const commit = (
          patch: Partial<{ params: Record<string, unknown>; enabled: boolean; autoApply: boolean }>,
        ) =>
          save.mutate({
            ruleKey,
            params: { ...params, ...(patch.params ?? {}) },
            enabled: patch.enabled ?? effective.enabled,
            autoApply: patch.autoApply ?? effective.autoApply,
          });
        return (
          <Card key={ruleKey}>
            <VStack gap="sm">
              <HStack justify="space-between" wrap>
                <Text weight="700">{t(`settings.ruleNames.${ruleKey}`)}</Text>
                {scoped && own ? (
                  <Badge tone="info" label={t('settings.adherentOverride')} />
                ) : null}
              </HStack>
              <Checkbox
                label={t('settings.enabled')}
                checked={effective.enabled}
                onChange={(v) => commit({ enabled: v })}
              />
              {ruleKey !== 'rest_time' ? (
                <Checkbox
                  label={t('settings.autoApply')}
                  description={t('settings.autoApplyHelp')}
                  checked={effective.autoApply}
                  onChange={(v) => commit({ autoApply: v })}
                />
              ) : null}
              <HStack gap="md" wrap align="flex-end">
                {Object.entries(DEFAULT_PARAMS[ruleKey]).map(([key, def]) => {
                  const label = t(`settings.params.${key}` as 'settings.params.sessions');
                  const value = params[key];
                  if (typeof def === 'boolean') {
                    return (
                      <Checkbox
                        key={key}
                        label={label}
                        checked={value === true}
                        onChange={(v) => commit({ params: { [key]: v } })}
                      />
                    );
                  }
                  if (typeof def === 'string') {
                    return (
                      <VStack key={key} gap="xxs" style={{ width: 200 }}>
                        <Text variant="caption" color="textSubtle">
                          {label}
                        </Text>
                        <SelectMenu
                          label={label}
                          value={String(value)}
                          options={(['variation', 'rep_range', 'deload'] as const).map((a) => ({
                            value: a,
                            label: t(`settings.actions.${a}`),
                          }))}
                          onChange={(v) => commit({ params: { [key]: v } })}
                        />
                      </VStack>
                    );
                  }
                  return (
                    <VStack key={key} gap="xxs" style={{ width: 170 }}>
                      <Text variant="caption" color="textSubtle" numberOfLines={2}>
                        {label}
                      </Text>
                      <NumberCell
                        label={label}
                        value={typeof value === 'number' ? value : null}
                        width={90}
                        max={1000}
                        onCommit={(v) => {
                          if (v !== null) commit({ params: { [key]: v } });
                        }}
                      />
                    </VStack>
                  );
                })}
              </HStack>
              {scoped && own ? (
                <Button
                  variant="ghost"
                  label={t('settings.resetOverride')}
                  onPress={() => reset.mutate(ruleKey)}
                  style={{ alignSelf: 'flex-start' }}
                />
              ) : null}
            </VStack>
          </Card>
        );
      })}
    </VStack>
  );
}
