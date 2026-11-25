import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  Card,
  HStack,
  IconBadge,
  LoadingState,
  SectionHeader,
  Text,
  VStack,
  type IconName,
} from '@/components/ui';
import {
  BADGE_KEYS,
  formatFrenchDate,
  formatInt,
  levelFor,
  type BadgeKey,
  type XpRules,
} from '@/core';
import { useTheme } from '@/theme/ThemeProvider';

import { levelName } from './levels';
import { useProgress, useXpRules } from './progress';

const BADGE_ICONS: Record<BadgeKey, IconName> = {
  first_session: 'barbell',
  sessions_10: 'medal-outline',
  sessions_50: 'medal',
  sessions_100: 'trophy',
  streak_4_weeks: 'flame',
  first_record: 'ribbon',
  challenge_won: 'flag',
};

type XpKind = 'session' | 'checkin' | 'full_week' | 'record' | 'challenge' | 'journal_day';
const XP_ICONS: Record<XpKind, IconName> = {
  session: 'barbell',
  checkin: 'clipboard',
  full_week: 'calendar',
  record: 'trophy',
  challenge: 'flag',
  journal_day: 'restaurant',
};

/** Niveau, XP, badges et barème (adhérent ; aussi utilisé dans la fiche adhérent du coach). */
export function ProgressView({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const progress = useProgress(uid);
  const rules = useXpRules();
  if (progress.isLoading || !progress.data) return <LoadingState />;

  const level = levelFor(progress.data.total);
  const nextName = level.next !== null ? levelName(t, level.index + 1) : null;
  const kindColor: Record<XpKind, string> = {
    session: theme.accent.training,
    checkin: theme.accent.checkins,
    full_week: theme.accent.program,
    record: theme.accent.records,
    challenge: theme.accent.suggestions,
    journal_day: theme.accent.nutrition,
  };

  return (
    <VStack gap="lg">
      <Card accent={theme.accent.records}>
        <VStack gap="sm">
          <HStack gap="md">
            <IconBadge icon="star" color={theme.accent.records} size={52} />
            <VStack gap="xxs" flex={1}>
              <Text variant="caption" color="textMuted">
                {t('community.progress.level', { n: level.index + 1 })}
              </Text>
              <Text variant="title">{levelName(t, level.index)}</Text>
            </VStack>
            <VStack gap="xxs" align="flex-end">
              <Text variant="headline" tabular style={{ color: theme.accent.records }}>
                {formatInt(progress.data.total)}
              </Text>
              <Text variant="caption" color="textMuted">
                XP
              </Text>
            </VStack>
          </HStack>
          <View
            style={{
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.colors.surfaceAlt,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${level.progress * 100}%`,
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.accent.records,
              }}
            />
          </View>
          <Text variant="caption" color="textSubtle">
            {nextName && level.next !== null
              ? t('community.progress.toNext', {
                  xp: formatInt(level.next - progress.data.total),
                  name: nextName,
                })
              : t('community.progress.maxLevel')}
          </Text>
        </VStack>
      </Card>

      <VStack gap="sm">
        <SectionHeader
          title={t('community.progress.badges')}
          icon="ribbon"
          accent={theme.accent.checkins}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {BADGE_KEYS.map((key) => {
            const earned = progress.data.badges.get(key);
            const color = earned ? theme.accent.checkins : theme.colors.textSubtle;
            return (
              <View
                key={key}
                accessibilityLabel={`${t(`community.badges.${key}`)} : ${
                  earned ? t('community.progress.earned') : t('community.progress.locked')
                }`}
                style={{
                  flexGrow: 1,
                  flexBasis: 150,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: earned ? `${color}66` : theme.colors.border,
                  backgroundColor: earned ? `${color}14` : 'transparent',
                  opacity: earned ? 1 : 0.6,
                  gap: 4,
                }}
              >
                <HStack gap="sm">
                  <IconBadge
                    icon={earned ? BADGE_ICONS[key] : 'lock-closed'}
                    color={color}
                    size={30}
                  />
                  <Text variant="small" weight="700" style={{ flex: 1 }}>
                    {t(`community.badges.${key}`)}
                  </Text>
                </HStack>
                <Text variant="caption" color="textSubtle">
                  {earned
                    ? t('community.progress.earnedOn', {
                        date: formatFrenchDate(earned.slice(0, 10)),
                      })
                    : t(`community.badgeHints.${key}`)}
                </Text>
              </View>
            );
          })}
        </View>
      </VStack>

      {rules.data ? <HowToEarn rules={rules.data} colors={kindColor} /> : null}

      {progress.data.recent.length > 0 ? (
        <VStack gap="sm">
          <SectionHeader
            title={t('community.progress.recent')}
            icon="time"
            accent={theme.accent.program}
          />
          <Card>
            <VStack gap="sm">
              {progress.data.recent.map((e, i) => (
                <HStack key={`${e.created_at}-${i}`} gap="sm">
                  <IconBadge icon={XP_ICONS[e.kind]} color={kindColor[e.kind]} size={26} />
                  <Text style={{ flex: 1 }}>{t(`community.xpKinds.${e.kind}`)}</Text>
                  <Text variant="caption" color="textSubtle">
                    {formatFrenchDate(e.occurred_on)}
                  </Text>
                  <Text weight="700" tabular style={{ color: theme.accent.records }}>
                    +{e.points}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Card>
        </VStack>
      ) : null}
    </VStack>
  );
}

function HowToEarn({ rules, colors }: { rules: XpRules; colors: Record<XpKind, string> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rows: { kind: XpKind; points: number }[] = [
    { kind: 'session', points: rules.session },
    { kind: 'full_week', points: rules.full_week },
    { kind: 'checkin', points: rules.checkin },
    { kind: 'record', points: rules.record },
    { kind: 'challenge', points: rules.challenge },
    { kind: 'journal_day', points: rules.journal_day },
  ];
  return (
    <VStack gap="sm">
      <SectionHeader
        title={t('community.progress.howTo')}
        icon="sparkles"
        accent={theme.accent.suggestions}
      />
      <Card>
        <VStack gap="sm">
          {rows.map((r) => (
            <HStack key={r.kind} gap="sm">
              <IconBadge icon={XP_ICONS[r.kind]} color={colors[r.kind]} size={26} />
              <Text style={{ flex: 1 }}>{t(`community.xpRules.${r.kind}`)}</Text>
              <Text weight="700" tabular>
                +{r.points} XP
              </Text>
            </HStack>
          ))}
          <Text variant="caption" color="textSubtle">
            {t('community.progress.cap', {
              cap: rules.daily_cap,
              records: rules.record_max_per_session,
            })}
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}
