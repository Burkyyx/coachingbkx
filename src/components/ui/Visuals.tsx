import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Icon, type IconName } from './Icon';
import { HStack } from './Layout';
import { Text } from './Text';

/** Pastille ronde colorée avec une icône. */
export function IconBadge({
  icon,
  color,
  size = 36,
}: {
  icon: IconName;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}26`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={size * 0.55} rawColor={color} />
    </View>
  );
}

/** Grand chiffre clé avec icône colorée. */
export function StatTile({
  icon,
  color,
  label,
  value,
  unit,
  caption,
  emphasis,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  emphasis?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: 170,
        minWidth: 150,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: emphasis ? `${color}1A` : theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: emphasis ? color : theme.colors.border,
        gap: theme.spacing.xs,
      }}
    >
      <HStack gap="sm">
        <IconBadge icon={icon} color={color} size={30} />
        <Text variant="small" color="textMuted" style={{ flex: 1 }}>
          {label}
        </Text>
      </HStack>
      <HStack gap="xs" align="flex-end">
        <Text variant="headline" tabular>
          {value}
        </Text>
        {unit ? (
          <Text variant="small" color="textMuted" style={{ marginBottom: 6 }}>
            {unit}
          </Text>
        ) : null}
      </HStack>
      {caption ? (
        <Text variant="caption" color="textSubtle">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Avatar à initiales, couleur stable par personne (calculée depuis son identifiant). */
export function Avatar({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const theme = useTheme();
  const palette = [
    theme.accent.training,
    theme.accent.program,
    theme.accent.nutrition,
    theme.accent.checkins,
    theme.accent.messages,
    theme.accent.suggestions,
    theme.accent.records,
    theme.accent.people,
  ];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = palette[hash % palette.length] ?? theme.accent.neutral;
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}26`,
        borderWidth: 1,
        borderColor: `${color}66`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text weight="700" style={{ color, fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials}
      </Text>
    </View>
  );
}

/** Titre de section avec pastille d'icône colorée. */
export function SectionTitle({
  icon,
  color,
  title,
  right,
}: {
  icon: IconName;
  color: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <HStack gap="sm">
      <IconBadge icon={icon} color={color} size={30} />
      <Text variant="subtitle" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {right}
    </HStack>
  );
}
