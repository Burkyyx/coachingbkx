import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { IconButton, NumberCell, SelectMenu, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { SET_TYPES, type PrescribedSet } from './api';
import type { TablesUpdate } from '@/lib/supabase';

export type EffortMode = 'rir' | 'rpe';

type Props = {
  set: PrescribedSet;
  index: number;
  effortMode: EffortMode;
  timed: boolean;
  compact: boolean;
  onUpdate: (patch: TablesUpdate<'prescribed_sets'>) => void;
  onDelete: () => void;
};

/** Une ligne du tableau des séries prescrites. */
export function SetRow({ set, index, effortMode, timed, compact, onUpdate, onDelete }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const pct = set.load_pct_1rm !== null;
  const [tempo, setTempo] = useState<string | null>(null);

  const commitTempo = () => {
    if (tempo === null) return;
    const v = tempo.trim().toUpperCase();
    setTempo(null);
    if (v === '' && set.tempo !== null) onUpdate({ tempo: null });
    else if (/^[0-9X]{4}$/.test(v) && v !== set.tempo) onUpdate({ tempo: v });
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: compact ? 'wrap' : 'nowrap',
        alignItems: compact ? 'flex-end' : 'center',
        gap: theme.spacing.xs,
        paddingVertical: 4,
      }}
    >
      <Text variant="small" color="textSubtle" style={{ width: 22 }} tabular>
        {index + 1}
      </Text>
      <View style={{ width: compact ? 120 : 118 }}>
        <SelectMenu
          compact
          label={t('programs.setType')}
          value={set.set_type}
          options={SET_TYPES.map((x) => ({ value: x, label: t(`enums.setType.${x}`) }))}
          onChange={(v) => onUpdate({ set_type: v })}
        />
      </View>
      {timed ? (
        <NumberCell
          label={t('programs.durationSeconds')}
          showLabel={compact}
          value={set.duration_seconds}
          decimals={0}
          max={7200}
          width={72}
          onCommit={(v) => onUpdate({ duration_seconds: v })}
        />
      ) : (
        <>
          <NumberCell
            label={t('programs.repsMin')}
            showLabel={compact}
            value={set.reps_min}
            decimals={0}
            max={200}
            width={56}
            onCommit={(v) =>
              onUpdate({
                reps_min: v,
                reps_max:
                  v !== null && set.reps_max !== null && v > set.reps_max ? v : set.reps_max,
              })
            }
          />
          <NumberCell
            label={t('programs.repsMax')}
            showLabel={compact}
            value={set.reps_max}
            decimals={0}
            max={200}
            width={56}
            onCommit={(v) =>
              onUpdate({
                reps_max: v,
                reps_min:
                  v !== null && set.reps_min !== null && v < set.reps_min ? v : set.reps_min,
              })
            }
          />
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        <NumberCell
          label={pct ? t('programs.loadPct') : t('programs.load')}
          showLabel={compact}
          value={pct ? set.load_pct_1rm : set.load_kg}
          max={pct ? 120 : 1000}
          width={64}
          onCommit={(v) => onUpdate(pct ? { load_pct_1rm: v } : { load_kg: v })}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pct ? t('programs.loadKg') : t('programs.loadPct')}
          onPress={() =>
            onUpdate(pct ? { load_pct_1rm: null } : { load_pct_1rm: 75, load_kg: null })
          }
          style={{
            height: 36,
            minWidth: 40,
            paddingHorizontal: 4,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text variant="caption" weight="700">
            {pct ? '%1RM' : 'kg'}
          </Text>
        </Pressable>
      </View>
      <NumberCell
        label={effortMode === 'rir' ? t('programs.targetRir') : t('programs.targetRpe')}
        showLabel={compact}
        value={effortMode === 'rir' ? set.target_rir : set.target_rpe}
        decimals={1}
        min={effortMode === 'rir' ? 0 : 1}
        max={10}
        width={52}
        onCommit={(v) =>
          onUpdate(
            effortMode === 'rir'
              ? { target_rir: v, target_rpe: null }
              : { target_rpe: v, target_rir: null },
          )
        }
      />
      <NumberCell
        label={t('programs.rest')}
        showLabel={compact}
        value={set.rest_seconds}
        decimals={0}
        max={1800}
        width={64}
        onCommit={(v) => onUpdate({ rest_seconds: v })}
      />
      <View style={{ width: 64, gap: 2 }}>
        {compact ? (
          <Text variant="caption" color="textSubtle">
            {t('programs.tempo')}
          </Text>
        ) : null}
        <TextInput
          accessibilityLabel={t('programs.tempo')}
          value={tempo ?? set.tempo ?? ''}
          onFocus={() => setTempo(set.tempo ?? '')}
          onChangeText={setTempo}
          onBlur={commitTempo}
          onSubmitEditing={commitTempo}
          maxLength={4}
          autoCapitalize="characters"
          placeholder="3010"
          placeholderTextColor={theme.colors.textSubtle}
          style={[
            theme.typography.small,
            {
              height: 36,
              textAlign: 'center',
              color: theme.colors.text,
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
          ]}
        />
      </View>
      <IconButton
        icon="trash-outline"
        label={t('programs.removeSet')}
        color="textMuted"
        size={18}
        onPress={onDelete}
      />
    </View>
  );
}

/** En-têtes de colonnes du tableau (affichés sur ordinateur). */
export function SetHeader({ effortMode, timed }: { effortMode: EffortMode; timed: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cell = (label: string, width: number) => (
    <Text variant="caption" color="textSubtle" style={{ width }} align="center" numberOfLines={1}>
      {label}
    </Text>
  );
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' }}>
      <View style={{ width: 22 }} />
      <Text variant="caption" color="textSubtle" style={{ width: 118 }}>
        {t('programs.setType')}
      </Text>
      {timed ? (
        cell(t('programs.durationSeconds'), 72)
      ) : (
        <>
          {cell(t('programs.repsMin'), 56)}
          {cell(t('programs.repsMax'), 56)}
        </>
      )}
      {cell(t('programs.load'), 106)}
      {cell(effortMode === 'rir' ? t('programs.targetRir') : t('programs.targetRpe'), 52)}
      {cell(t('programs.rest'), 64)}
      {cell(t('programs.tempo'), 64)}
    </View>
  );
}
