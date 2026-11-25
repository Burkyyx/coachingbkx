import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, Text, TextField, VStack, useFeedback } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { hasActiveConsent } from '@/features/auth/consents';
import { toUserMessage } from '@/lib/errors';

import { communityKeys, defaultDisplayName, joinCommunity, markCommunityPrompted } from './api';

/**
 * Rejoindre la communauté : explication, pseudo, posts automatiques (désactivés par défaut).
 * Le consentement « communauté » est enregistré au clic sur « Rejoindre ».
 */
export function JoinCommunity({ onDone, showLater }: { onDone?: () => void; showLater?: boolean }) {
  const { t } = useTranslation();
  const { toast } = useFeedback();
  const qc = useQueryClient();
  const { userId, profile, consents, refresh } = useAuth();
  const [name, setName] = useState(() =>
    profile
      ? defaultDisplayName({
          nickname: profile.nickname,
          first_name: profile.first_name,
          last_name: profile.last_name,
        })
      : '',
  );
  const [autoPosts, setAutoPosts] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await joinCommunity(userId, {
        displayName: name,
        autoPosts,
        hasConsent: hasActiveConsent(consents, 'community'),
      });
      await refresh();
      void qc.invalidateQueries({ queryKey: communityKeys.all });
      toast(t('community.joined'));
      onDone?.();
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const later = async () => {
    if (userId) await markCommunityPrompted(userId).catch(() => undefined);
    await refresh();
    onDone?.();
  };

  return (
    <VStack gap="md">
      <Text color="textMuted">{t('community.joinBody')}</Text>
      <Text variant="small">{t('consents.types.community.body')}</Text>
      <TextField
        label={t('community.joinPseudo')}
        hint={t('community.joinPseudoHint')}
        value={name}
        onChangeText={setName}
        maxLength={30}
        autoCapitalize="none"
      />
      <Checkbox
        checked={autoPosts}
        onChange={setAutoPosts}
        label={t('community.autoPosts')}
        description={t('community.autoPostsHint')}
      />
      <Button
        icon="people"
        label={t('community.join')}
        loading={busy}
        disabled={!name.trim()}
        onPress={() => void join()}
      />
      {showLater ? (
        <Button variant="ghost" label={t('community.later')} onPress={() => void later()} />
      ) : null}
    </VStack>
  );
}
