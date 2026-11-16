import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { HStack } from './Layout';
import { Sheet } from './Sheet';
import { Text } from './Text';

/**
 * Retours visuels communs : boîte de confirmation (Alert ne fonctionne pas sur le web)
 * et petit message temporaire (« toast »).
 */

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type FeedbackValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (message: string) => void;
};

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setDialog(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setDialog(null);
  };

  const toast = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);

  const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Sheet
        visible={dialog !== null}
        onClose={() => close(false)}
        title={dialog?.title ?? ''}
        maxWidth={460}
        scroll={false}
        footer={
          <HStack justify="flex-end" gap="sm">
            <Button variant="ghost" label={t('common.cancel')} onPress={() => close(false)} />
            <Button
              variant={dialog?.destructive ? 'danger' : 'primary'}
              label={dialog?.confirmLabel ?? t('common.confirm')}
              onPress={() => close(true)}
            />
          </HStack>
        }
      >
        {dialog?.message ? <Text color="textMuted">{dialog.message}</Text> : null}
      </Sheet>
      {message ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + 80,
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.text,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              maxWidth: 480,
            }}
          >
            <Text color="background" weight="600" align="center">
              {message}
            </Text>
          </View>
        </View>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback doit être utilisé dans <FeedbackProvider>');
  return ctx;
}
