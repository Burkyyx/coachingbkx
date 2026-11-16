import { useState, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Text, VStack } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

import { useAuth } from './AuthProvider';
import { CONSENT_VERSION, hasActiveConsent, type ConsentType } from './consents';

/**
 * Affiche le contenu seulement si le consentement correspondant a été donné ;
 * sinon, le demande (consentement séparé, au moment où la fonction est utilisée).
 */
export function ConsentGate({
  type,
  title,
  body,
  children,
}: PropsWithChildren<{ type: ConsentType; title: string; body: string }>) {
  const { t } = useTranslation();
  const { consents, userId, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (hasActiveConsent(consents, type)) return <>{children}</>;

  const accept = async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase
      .from('consents')
      .insert({ user_id: userId, type, version: CONSENT_VERSION });
    if (e) setError(toUserMessage(e));
    else await refresh();
    setBusy(false);
  };

  return (
    <Card>
      <VStack gap="md">
        <Text variant="subtitle">{title}</Text>
        <Text color="textMuted">{body}</Text>
        <Text variant="small">{t(`consents.types.${type}.body`)}</Text>
        {error ? <Text color="danger">{error}</Text> : null}
        <Button label={t('checkin.consentAccept')} loading={busy} onPress={() => void accept()} />
      </VStack>
    </Card>
  );
}
