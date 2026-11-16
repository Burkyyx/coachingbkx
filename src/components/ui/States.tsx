import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** État vide : rien à afficher, avec un message clair et une action éventuelle. */
export function EmptyState({
  icon = 'file-tray-outline',
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: theme.spacing.xxl, gap: theme.spacing.md }}>
      <Icon name={icon} size={40} color="textSubtle" />
      <Text variant="subtitle" align="center">
        {title}
      </Text>
      {body ? (
        <Text color="textMuted" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

/** Chargement en cours. */
export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{ alignItems: 'center', padding: theme.spacing.xxl, gap: theme.spacing.md }}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t('common.loading')}
    >
      <ActivityIndicator color={theme.colors.text} />
      <Text color="textMuted">{label ?? t('common.loading')}</Text>
    </View>
  );
}

/** Erreur, avec bouton « Réessayer ». */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'center', padding: theme.spacing.xxl, gap: theme.spacing.md }}>
      <Icon name="cloud-offline-outline" size={40} color="textSubtle" />
      <Text variant="subtitle" align="center">
        {t('common.errorTitle')}
      </Text>
      <Text color="textMuted" align="center">
        {message ?? t('common.errorBody')}
      </Text>
      {onRetry ? <Button variant="secondary" label={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}
