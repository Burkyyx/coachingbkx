import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/** Onglets du bas : Aujourd'hui · Programme · Nutrition · Communauté · Profil. */
export default function AdherentTabs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const icon = (name: IconName) =>
    function TabBarIcon({ color }: { color: unknown }) {
      return <Icon name={name} rawColor={String(color)} size={24} />;
    };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          tabBarActiveTintColor: theme.accent.training,
          title: t('nav.today'),
          tabBarIcon: icon('flash-outline'),
        }}
      />
      <Tabs.Screen
        name="program"
        options={{
          tabBarActiveTintColor: theme.accent.program,
          title: t('nav.program'),
          tabBarIcon: icon('calendar-outline'),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          tabBarActiveTintColor: theme.accent.nutrition,
          title: t('nav.nutrition'),
          tabBarIcon: icon('restaurant-outline'),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarActiveTintColor: theme.accent.community,
          title: t('nav.community'),
          tabBarIcon: icon('people-outline'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarActiveTintColor: theme.accent.checkins,
          title: t('nav.profile'),
          tabBarIcon: icon('person-circle-outline'),
        }}
      />
    </Tabs>
  );
}
