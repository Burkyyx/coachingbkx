import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BottomBar, Sidebar, useIsDesktop, type NavItem } from '@/components/AppNav';
import { Button, HStack, Text, VStack } from '@/components/ui';
import { signOut } from '@/features/auth/api';
import { useCoachBadges } from '@/features/coach/useCoachBadges';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Espace coach : barre latérale sur ordinateur, barre du bas sur mobile.
 */
export default function CoachLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const desktop = useIsDesktop();
  const badges = useCoachBadges();

  const items: NavItem[] = [
    {
      href: '/coach',
      match: '/coach',
      exact: true,
      label: t('nav.dashboard'),
      icon: 'grid-outline',
      accent: theme.accent.program,
      primary: true,
    },
    {
      href: '/coach/adherents',
      match: '/coach/adherents',
      label: t('nav.adherents'),
      icon: 'people-outline',
      accent: theme.accent.people,
      primary: true,
    },
    {
      href: '/coach/suggestions',
      match: '/coach/suggestions',
      label: t('nav.suggestions'),
      icon: 'sparkles-outline',
      accent: theme.accent.suggestions,
      badge: badges.pendingSuggestions,
      primary: true,
    },
    {
      href: '/coach/programs',
      match: '/coach/programs',
      label: t('nav.programs'),
      icon: 'clipboard-outline',
      accent: theme.accent.training,
      primary: true,
    },
    {
      href: '/coach/exercises',
      match: '/coach/exercises',
      label: t('nav.exercises'),
      icon: 'barbell-outline',
      accent: theme.accent.progress,
    },
    {
      href: '/coach/messages',
      match: '/coach/messages',
      label: t('nav.messages'),
      icon: 'chatbubbles-outline',
      accent: theme.accent.messages,
      badge: badges.unreadMessages,
      primary: true,
    },
    {
      href: '/coach/invitations',
      match: '/coach/invitations',
      label: t('nav.invitations'),
      icon: 'person-add-outline',
      accent: theme.accent.checkins,
    },
    {
      href: '/coach/settings',
      match: '/coach/settings',
      label: t('nav.settings'),
      icon: 'settings-outline',
      accent: theme.accent.neutral,
    },
  ];

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );

  if (desktop) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background }}>
        <Sidebar
          items={items}
          header={
            <VStack
              gap="xxs"
              style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg }}
            >
              <HStack justify="space-between">
                <VStack gap="xxs">
                  <Text variant="title">{t('app.name')}</Text>
                  <Text variant="caption" color="textSubtle">
                    Espace coach
                  </Text>
                </VStack>
                <NotificationBell />
              </HStack>
            </VStack>
          }
          footer={
            <View style={{ paddingHorizontal: theme.spacing.sm }}>
              <Button
                variant="ghost"
                icon="log-out-outline"
                label={t('auth.signOut')}
                onPress={() => void signOut()}
              />
            </View>
          }
        />
        <View style={{ flex: 1 }}>{stack}</View>
      </View>
    );
  }

  // Mobile : 4 entrées principales + « Plus » (réglages : exercices, invitations…).
  const mobileItems: NavItem[] = [
    ...items.filter((i) => i.primary),
    {
      href: '/coach/settings',
      match: '/coach/settings',
      label: 'Plus',
      icon: 'ellipsis-horizontal',
      accent: theme.accent.neutral,
    },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1 }}>{stack}</View>
      <BottomBar items={mobileItems.filter((i) => i.match !== '/coach/programs')} />
    </View>
  );
}
