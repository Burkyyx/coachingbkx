import type { PropsWithChildren, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { DESKTOP_BREAKPOINT } from '@/theme/tokens';

import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  /** Largeur max sur ordinateur. */
  maxWidth?: number;
  scroll?: boolean;
}>;

/**
 * Fenêtre modale : centrée sur ordinateur, « tiroir » depuis le bas sur mobile.
 */
export function Sheet({
  visible,
  onClose,
  title,
  footer,
  maxWidth = 640,
  scroll = true,
  children,
}: Props) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const desktop = width >= DESKTOP_BREAKPOINT;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={desktop ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: desktop ? 'center' : 'flex-end',
          alignItems: 'center',
          padding: desktop ? theme.spacing.xl : 0,
        }}
      >
        <Pressable
          accessibilityLabel="Fermer"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: desktop ? maxWidth : undefined,
            maxHeight: desktop ? height * 0.88 : height * 0.92,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            borderBottomLeftRadius: desktop ? theme.radius.lg : 0,
            borderBottomRightRadius: desktop ? theme.radius.lg : 0,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingBottom: desktop ? 0 : insets.bottom,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: theme.spacing.lg,
              paddingRight: theme.spacing.xs,
              paddingVertical: theme.spacing.xs,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text
              variant="subtitle"
              style={{ flex: 1 }}
              accessibilityRole="header"
              numberOfLines={1}
            >
              {title}
            </Text>
            <IconButton icon="close" label="Fermer" onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md, flexShrink: 1 }}>
              {children}
            </View>
          )}
          {footer ? (
            <View
              style={{
                padding: theme.spacing.lg,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
                gap: theme.spacing.sm,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
