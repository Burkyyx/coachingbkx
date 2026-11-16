import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Button, EmptyState, Icon, IconButton, Sheet, Text, VStack } from '@/components/ui';
import { formatRelative } from '@/core';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

import { openNotification, useMarkAllRead, useNotifications } from './api';

/** Cloche + centre de notifications. */
export function NotificationBell() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { userId } = useAuth();
  const list = useNotifications(userId);
  const markAll = useMarkAllRead(userId);
  const [open, setOpen] = useState(false);
  const unread = (list.data ?? []).filter((n) => n.read_at === null).length;

  return (
    <>
      <View>
        <IconButton
          icon="notifications-outline"
          label={t('notifications.title')}
          onPress={() => setOpen(true)}
          filled
        />
        {unread > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: theme.colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="caption" weight="700" style={{ color: '#fff' }}>
              {unread > 9 ? '9+' : unread}
            </Text>
          </View>
        ) : null}
      </View>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('notifications.title')}
        footer={
          unread > 0 ? (
            <Button
              variant="secondary"
              label={t('notifications.markAllRead')}
              onPress={() => markAll.mutate()}
              fullWidth
            />
          ) : undefined
        }
      >
        {(list.data ?? []).length === 0 ? (
          <EmptyState icon="notifications-off-outline" title={t('notifications.empty')} />
        ) : null}
        <VStack gap="xs">
          {(list.data ?? []).map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                openNotification(n);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: theme.spacing.sm,
                padding: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor:
                  pressed || n.read_at === null ? theme.colors.surfaceAlt : 'transparent',
              })}
            >
              <Icon
                name={n.read_at === null ? 'ellipse' : 'ellipse-outline'}
                size={10}
                color={n.read_at === null ? 'info' : 'textSubtle'}
              />
              <VStack gap="xxs" flex={1}>
                <Text weight="700">{n.title}</Text>
                <Text variant="small" color="textMuted">
                  {n.body}
                </Text>
                <Text variant="caption" color="textSubtle">
                  {formatRelative(n.created_at)}
                </Text>
              </VStack>
            </Pressable>
          ))}
        </VStack>
      </Sheet>
    </>
  );
}
