import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import type { spacing as spacingTokens } from '@/theme/tokens';

import { Text } from './Text';

type Gap = keyof typeof spacingTokens;

type StackProps = PropsWithChildren<{
  gap?: Gap;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: number;
}>;

/** Empile les enfants verticalement avec un espacement régulier. */
export function VStack({ gap = 'md', align, justify, style, flex, children }: StackProps) {
  const theme = useTheme();
  return (
    <View
      style={[{ gap: theme.spacing[gap], alignItems: align, justifyContent: justify, flex }, style]}
    >
      {children}
    </View>
  );
}

/** Aligne les enfants horizontalement. */
export function HStack({
  gap = 'sm',
  align = 'center',
  justify,
  wrap,
  style,
  flex,
  children,
}: StackProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: theme.spacing[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          flex,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type ScreenProps = PropsWithChildren<{
  /** Contenu défilant (par défaut). Mettre `false` pour les listes (FlatList gère son défilement). */
  scroll?: boolean;
  /** Largeur maximale du contenu (lisibilité sur grand écran). */
  maxWidth?: number;
  edges?: Edge[];
  padded?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  footer?: ReactNode;
}>;

/**
 * Conteneur d'écran : marges de sécurité (encoche), fond du thème,
 * défilement et largeur max centrée sur ordinateur.
 */
export function Screen({
  scroll = true,
  maxWidth = 1200,
  edges = ['top', 'bottom'],
  padded = true,
  onRefresh,
  refreshing = false,
  footer,
  children,
}: ScreenProps) {
  const theme = useTheme();
  const inner: ViewStyle = {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
    padding: padded ? theme.spacing.lg : 0,
    gap: theme.spacing.lg,
  };
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[inner, { paddingBottom: theme.spacing.xxxl }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.text}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[inner, { flex: 1 }]}>{children}</View>
        )}
        {footer ? (
          <View
            style={{
              padding: theme.spacing.lg,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
            }}
          >
            <View style={{ width: '100%', maxWidth, alignSelf: 'center' }}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Titre de section avec action optionnelle à droite. */
export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <HStack justify="space-between">
      <Text variant="subtitle" accessibilityRole="header">
        {title}
      </Text>
      {right}
    </HStack>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />;
}
