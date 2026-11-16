import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { Button, Card, HStack, Screen, Text, VStack } from '@/components/ui';
import { env } from '@/lib/env';
import { useTheme } from '@/theme/ThemeProvider';

/** Mise en page des écrans de connexion : logo + carte centrée. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Screen maxWidth={460}>
      <VStack gap="xl" style={{ paddingTop: theme.spacing.xxl }}>
        <VStack gap="xs" align="center">
          <Text variant="display" accessibilityRole="header">
            {t('app.name')}
          </Text>
          <Text color="textMuted">{t('app.tagline')}</Text>
        </VStack>
        <Card>
          <VStack gap="lg">
            <VStack gap="xs">
              <Text variant="title" accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text color="textMuted">{subtitle}</Text> : null}
            </VStack>
            {children}
          </VStack>
        </Card>
      </VStack>
    </Screen>
  );
}

/** Boutons « Continuer avec Google / Apple » (affichés seulement s'ils sont configurés). */
export function SocialButtons({
  onGoogle,
  onApple,
  loading,
}: {
  onGoogle: () => void;
  onApple: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Apple : bouton proposé sur iPhone et sur le web.
  const showApple = env.enableAppleAuth && Platform.OS !== 'android';
  if (!env.enableGoogleAuth && !showApple) return null;
  return (
    <VStack gap="sm">
      <HStack gap="sm">
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
        <Text variant="small" color="textSubtle">
          {t('auth.or')}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
      </HStack>
      {env.enableGoogleAuth ? (
        <Button
          variant="secondary"
          icon="logo-google"
          label={t('auth.withGoogle')}
          onPress={onGoogle}
          disabled={loading}
          fullWidth
        />
      ) : null}
      {showApple ? (
        <Button
          variant="secondary"
          icon="logo-apple"
          label={t('auth.withApple')}
          onPress={onApple}
          disabled={loading}
          fullWidth
        />
      ) : null}
    </VStack>
  );
}

/** Message d'erreur ou d'information dans un formulaire. */
export function FormMessage({ tone, children }: PropsWithChildren<{ tone: 'error' | 'info' }>) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: tone === 'error' ? theme.colors.danger : theme.colors.border,
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      <Text variant="small" color={tone === 'error' ? 'danger' : 'text'}>
        {children}
      </Text>
    </View>
  );
}
