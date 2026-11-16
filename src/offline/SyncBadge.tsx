import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

import { syncNow, useSyncStatus } from './sync';

/**
 * Indicateur discret « non synchronisé » : visible seulement s'il reste des
 * données à envoyer. Un appui relance l'envoi.
 */
export function SyncBadge() {
  const { t } = useTranslation();
  const theme = useTheme();
  const pending = useSyncStatus((s) => s.pending);
  const syncing = useSyncStatus((s) => s.syncing);
  if (pending === 0) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.offlineBadgeCount', { count: pending })}
      onPress={() => void syncNow()}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.warning,
      }}
    >
      <Icon name={syncing ? 'sync' : 'cloud-offline-outline'} size={14} color="warning" />
      <Text variant="caption" weight="600" color="warning">
        {syncing ? t('common.syncing') : `${t('common.offlineBadge')} (${pending})`}
      </Text>
    </Pressable>
  );
}
