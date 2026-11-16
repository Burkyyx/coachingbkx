import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Card,
  HStack,
  ListRow,
  NumberCell,
  Screen,
  SectionHeader,
  Segmented,
  SelectMenu,
  Text,
  VStack,
  useFeedback,
} from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { RuleEditor } from '@/features/coach/RuleEditor';
import { toUserMessage } from '@/lib/errors';
import { supabase, type TablesUpdate } from '@/lib/supabase';
import { usePreferences } from '@/stores/preferences';

/** Réglages du coach : général, règles de suggestion, apparence. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);

  const settings = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').single();
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async (patch: TablesUpdate<'app_settings'>) => {
      const { error } = await supabase.from('app_settings').update(patch).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast(t('settings.saved'));
      void qc.invalidateQueries({ queryKey: ['app-settings'] });
    },
    onError: (e) => toast(toUserMessage(e)),
  });

  const s = settings.data;
  const numberRow = (
    label: string,
    key: keyof TablesUpdate<'app_settings'>,
    value: number | undefined,
    max: number,
  ) => (
    <HStack justify="space-between" key={key}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <NumberCell
        label={label}
        value={value ?? null}
        decimals={0}
        min={0}
        max={max}
        width={72}
        onCommit={(v) => {
          if (v !== null) update.mutate({ [key]: v });
        }}
      />
    </HStack>
  );

  return (
    <Screen maxWidth={900}>
      <Text variant="headline" accessibilityRole="header">
        {t('settings.title')}
      </Text>

      <SectionHeader title={t('settings.shortcuts')} />
      <Card>
        <ListRow
          icon="clipboard-outline"
          title={t('nav.programs')}
          onPress={() => router.push('/coach/programs')}
        />
        <ListRow
          icon="barbell-outline"
          title={t('nav.exercises')}
          onPress={() => router.push('/coach/exercises')}
        />
        <ListRow
          icon="person-add-outline"
          title={t('nav.invitations')}
          onPress={() => router.push('/coach/invitations')}
        />
      </Card>

      <SectionHeader title={t('settings.general')} />
      <Card>
        {s ? (
          <VStack gap="md">
            {numberRow(t('settings.inactivityDays'), 'inactivity_days', s.inactivity_days, 60)}
            <HStack justify="space-between">
              <Text style={{ flex: 1 }}>{t('settings.defaultCheckinDay')}</Text>
              <SelectMenu
                label={t('settings.defaultCheckinDay')}
                value={s.default_checkin_weekday}
                options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({
                  value: d,
                  label: t(`enums.weekday.${d}` as 'enums.weekday.1'),
                }))}
                onChange={(v) => update.mutate({ default_checkin_weekday: v })}
              />
            </HStack>
            {numberRow(
              t('settings.invitationDays'),
              'invitation_validity_days',
              s.invitation_validity_days,
              90,
            )}
            {numberRow(
              t('settings.sessionReminderHour'),
              'session_reminder_hour',
              s.session_reminder_hour,
              23,
            )}
            {numberRow(
              t('settings.checkinReminderHour'),
              'checkin_reminder_hour',
              s.checkin_reminder_hour,
              23,
            )}
          </VStack>
        ) : null}
      </Card>

      <SectionHeader title={t('settings.rules')} />
      <Text color="textMuted">{t('settings.rulesHelp')}</Text>
      <RuleEditor />

      <SectionHeader title={t('settings.appearance')} />
      <Segmented
        options={[
          { value: 'dark' as const, label: t('settings.themeDark') },
          { value: 'light' as const, label: t('settings.themeLight') },
          { value: 'system' as const, label: t('settings.themeSystem') },
        ]}
        value={theme}
        onChange={setTheme}
      />

      <Button
        variant="ghost"
        icon="log-out-outline"
        label={t('auth.signOut')}
        onPress={() => void signOut()}
        style={{ alignSelf: 'flex-start' }}
      />
    </Screen>
  );
}
