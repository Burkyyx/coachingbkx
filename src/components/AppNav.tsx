import { router, usePathname, type Href } from 'expo-router';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { DESKTOP_BREAKPOINT, MIN_TOUCH } from '@/theme/tokens';

import { Icon, type IconName } from './ui/Icon';
import { Text } from './ui/Text';

export type NavItem = {
  href: Href;
  /** Préfixe d'URL qui rend l'entrée active. */
  match: string;
  label: string;
  icon: IconName;
  /** Couleur d'accent de l'entrée (icône, fond de l'entrée active). */
  accent?: string;
  badge?: number;
  /** Affiché dans la barre du bas sur mobile (sinon seulement dans le menu « Plus »). */
  primary?: boolean;
  exact?: boolean;
};

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact
    ? pathname === item.match
    : pathname === item.match || pathname.startsWith(`${item.match}/`);
}

function BadgeDot({ count }: { count: number }) {
  const theme = useTheme();
  if (count <= 0) return null;
  return (
    <View
      style={{
        minWidth: 20,
        height: 20,
        paddingHorizontal: 5,
        borderRadius: 10,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="caption" weight="700" color="onPrimary">
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

/** Barre latérale (ordinateur). */
export function Sidebar({
  items,
  header,
  footer,
}: {
  items: NavItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const pathname = usePathname();
  return (
    <View
      accessibilityRole="menu"
      style={{
        width: 248,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingVertical: theme.spacing.lg,
      }}
    >
      {header}
      <ScrollView contentContainerStyle={{ gap: 2, paddingHorizontal: theme.spacing.sm }}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Pressable
              key={item.match}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              onPress={() => router.navigate(item.href)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: MIN_TOUCH,
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.md,
                backgroundColor: active
                  ? `${item.accent ?? theme.colors.text}1F`
                  : pressed
                    ? theme.colors.surfaceAlt
                    : 'transparent',
              })}
            >
              <Icon
                name={item.icon}
                rawColor={item.accent ?? (active ? theme.colors.text : theme.colors.textMuted)}
                size={20}
              />
              <Text
                weight={active ? '700' : '500'}
                color={active ? 'text' : 'textMuted'}
                style={{ flex: 1 }}
              >
                {item.label}
              </Text>
              <BadgeDot count={item.badge ?? 0} />
            </Pressable>
          );
        })}
      </ScrollView>
      {footer}
    </View>
  );
}

/** Barre de navigation du bas (mobile). */
export function BottomBar({ items }: { items: NavItem[] }) {
  const theme = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        paddingBottom: insets.bottom,
      }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Pressable
            key={item.match}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            onPress={() => router.navigate(item.href)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.spacing.sm,
              minHeight: 56,
              gap: 2,
            }}
          >
            <View>
              <Icon
                name={item.icon}
                rawColor={active ? (item.accent ?? theme.colors.text) : theme.colors.textSubtle}
                size={24}
              />
              {item.badge ? (
                <View style={{ position: 'absolute', top: -6, right: -12 }}>
                  <BadgeDot count={item.badge} />
                </View>
              ) : null}
            </View>
            <Text
              variant="caption"
              weight={active ? '700' : '500'}
              color={active ? 'text' : 'textSubtle'}
              style={active && item.accent ? { color: item.accent } : undefined}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
