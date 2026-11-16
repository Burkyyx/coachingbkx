import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, View } from 'react-native';

import { Button, HStack, Icon, Text, VStack } from '@/components/ui';
import { formatKg, formatNumber, formatRepRange, formatTimer, type RecordDraft } from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

import type { ActiveSet, RestTimer } from './engine';
import { tap } from './restAlarm';

/** Heure courante, rafraîchie régulièrement (pour les minuteurs). */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Minuteur de repos : compte à rebours, +30 s / −15 s, « Je reprends ». */
export function RestPanel({
  rest,
  onAdjust,
  onResume,
}: {
  rest: RestTimer;
  onAdjust: (delta: number) => void;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const now = useNow();
  const remaining = Math.max(0, (rest.endsAt - now) / 1000);
  const elapsed = Math.max(0, (now - rest.startedAt) / 1000);
  const finished = remaining <= 0;
  const total = Math.max(1, (rest.endsAt - rest.startedAt) / 1000);
  const progress = Math.min(1, elapsed / total);

  const buzzed = useRef(false);
  useEffect(() => {
    if (finished && !buzzed.current) {
      buzzed.current = true;
      tap('success');
    }
  }, [finished]);

  return (
    <View accessibilityLiveRegion="polite" style={{ gap: theme.spacing.sm }}>
      <HStack gap="sm">
        <VStack gap="xxs" flex={1}>
          <Text variant="caption" weight="700" color={finished ? 'success' : 'textMuted'}>
            {finished ? t('training.restDone') : t('training.rest')}
          </Text>
          <Text
            variant="headline"
            tabular
            color={finished ? 'success' : 'text'}
            accessibilityLabel={`${Math.ceil(remaining)} secondes`}
          >
            {formatTimer(remaining)}
          </Text>
        </VStack>
        <Button variant="secondary" label={t('training.minus15')} onPress={() => onAdjust(-15)} />
        <Button variant="secondary" label={t('training.plus30')} onPress={() => onAdjust(30)} />
      </HStack>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceAlt }}>
        <View
          style={{
            width: `${progress * 100}%`,
            height: 4,
            borderRadius: 2,
            backgroundColor: finished ? theme.colors.success : theme.colors.text,
          }}
        />
      </View>
      <Button size="lg" icon="play" label={t('training.resumeNow')} onPress={onResume} fullWidth />
    </View>
  );
}

/** Choix du RIR ou du RPE en un tap. */
export function EffortPicker({
  scale,
  value,
  onChange,
}: {
  scale: 'rir' | 'rpe';
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const options = scale === 'rir' ? [0, 1, 2, 3, 4, 5] : [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
  return (
    <VStack gap="xs">
      <Text variant="small" weight="600" color="textMuted">
        {scale === 'rir' ? t('training.rir') : t('training.rpe')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {options.map((o) => {
          const selected = value === o;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${scale.toUpperCase()} ${formatNumber(o)}`}
              onPress={() => {
                tap();
                onChange(selected ? null : o);
              }}
              style={({ pressed }) => ({
                minWidth: 46,
                height: 52,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceAlt,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="subtitle" color={selected ? 'onPrimary' : 'text'}>
                {scale === 'rir' && o === 5 ? '5+' : formatNumber(o)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {scale === 'rir' ? (
        <Text variant="caption" color="textSubtle">
          {t('training.rirHint')}
        </Text>
      ) : null}
    </VStack>
  );
}

/** Pastilles de séries (vue d'ensemble de l'exercice) ; un appui sélectionne la série. */
export function SetDots({
  sets,
  current,
  onSelect,
}: {
  sets: readonly ActiveSet[];
  current: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {sets.map((s, i) => {
        const selected = i === current;
        const label =
          s.status === 'todo'
            ? `${s.targetLoadKg !== null ? formatKg(s.targetLoadKg) + ' · ' : ''}${formatRepRange(s.repsMin, s.repsMax)} reps`
            : `${s.loadKg !== null ? formatKg(s.loadKg) + ' × ' : ''}${s.reps ?? s.durationSeconds ?? '—'}${s.rir !== null ? ` · RIR ${formatNumber(s.rir)}` : s.rpe !== null ? ` · RPE ${formatNumber(s.rpe)}` : ''}`;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${t('programs.set')} ${i + 1} : ${label}`}
            onPress={() => onSelect(i)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              minHeight: 44,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? theme.colors.text : theme.colors.border,
              backgroundColor: s.status === 'done' ? theme.colors.surfaceAlt : 'transparent',
            }}
          >
            <Icon
              name={
                s.status === 'done'
                  ? 'checkmark-circle'
                  : s.status === 'failed'
                    ? 'close-circle'
                    : 'ellipse-outline'
              }
              color={
                s.status === 'done' ? 'success' : s.status === 'failed' ? 'danger' : 'textSubtle'
              }
              size={20}
            />
            <Text
              variant="small"
              weight="600"
              style={{ width: 70 }}
              color={s.setType === 'warmup' ? 'textMuted' : 'text'}
            >
              {s.setType === 'warmup' ? t('training.warmup') : `${t('programs.set')} ${i + 1}`}
            </Text>
            <Text variant="small" color="textMuted" style={{ flex: 1 }} tabular>
              {label}
            </Text>
            {s.record ? <Icon name="trophy" color="highlight" size={18} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Petite animation de célébration d'un record (ne bloque rien, disparaît seule). */
export function RecordCelebration({ record, onDone }: { record: RecordDraft; onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(0.6));
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    tap('success');
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(onDone);
    }, 2200);
    return () => clearTimeout(id);
  }, [scale, opacity, onDone]);
  const value = formatNumber(record.value);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="assertive"
      style={{
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity,
        transform: [{ scale }],
        zIndex: 20,
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.highlight,
          borderWidth: 2,
          borderRadius: theme.radius.lg,
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xl,
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Text variant="display">🏆</Text>
        <Text variant="title" color="highlight">
          {t('training.newRecord')}
        </Text>
        <Text weight="600">
          {t(`training.recordTypes.${record.recordType}`, {
            value,
            load: record.loadKg !== null ? formatNumber(record.loadKg) : '',
          })}
        </Text>
      </View>
    </Animated.View>
  );
}
