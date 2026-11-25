import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  IconButton,
  LoadingState,
  Screen,
  Text,
  TextField,
  VStack,
  useFeedback,
} from '@/components/ui';
import { formatFrenchDate } from '@/core';
import { fullName } from '@/features/coach/api';
import { env } from '@/lib/env';
import { toUserMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** Lien d'inscription pré-rempli avec le code. */
function invitationLink(code: string): string {
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : env.webUrl;
  return `${origin}/invitation?code=${code}`;
}

export default function InvitationsScreen() {
  const { t } = useTranslation();
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [label, setLabel] = useState('');

  const settings = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').single();
      if (error) throw error;
      return data;
    },
  });
  const list = useQuery({
    queryKey: ['coach', 'invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, user:profiles!invitations_used_by_fkey(first_name, last_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_invitation', { p_label: label });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setLabel('');
      toast(t('invitations.created'));
      void qc.invalidateQueries({ queryKey: ['coach', 'invitations'] });
    },
    onError: (e) => toast(toUserMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coach', 'invitations'] }),
  });

  // Suppression définitive (un ou plusieurs codes). Les comptes déjà créés ne sont pas touchés.
  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('invitations').delete().in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coach', 'invitations'] }),
    onError: (e) => toast(toUserMessage(e)),
  });
  const deleteOne = async (id: string, code: string) => {
    const ok = await confirm({
      title: t('invitations.delete'),
      message: t('invitations.deleteConfirm', { code }),
      confirmLabel: t('invitations.delete'),
      destructive: true,
    });
    if (!ok) return;
    await remove.mutateAsync([id]);
    toast(t('invitations.deleted'));
  };

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    toast(t('invitations.copied'));
  };
  const share = async (code: string) => {
    const message = t('invitations.shareMessage', { code, link: invitationLink(code) });
    try {
      await Share.share({ message });
    } catch {
      await copy(message);
    }
  };

  const now = new Date().toISOString();
  const statusOf = (inv: {
    used_at: string | null;
    revoked_at: string | null;
    expires_at: string;
  }) =>
    inv.used_at ? 'used' : inv.revoked_at ? 'revoked' : inv.expires_at < now ? 'expired' : 'valid';
  const finished = (list.data ?? []).filter((inv) => statusOf(inv) !== 'valid');
  const cleanup = async () => {
    const ok = await confirm({
      title: t('invitations.cleanup', { count: finished.length }),
      message: t('invitations.cleanupConfirm', { count: finished.length }),
      confirmLabel: t('invitations.delete'),
      destructive: true,
    });
    if (!ok) return;
    const count = await remove.mutateAsync(finished.map((inv) => inv.id));
    toast(t('invitations.cleanedUp', { count }));
  };

  return (
    <Screen maxWidth={900} onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      <VStack gap="xxs">
        <Text variant="headline" accessibilityRole="header">
          {t('invitations.title')}
        </Text>
        <Text color="textMuted">
          {t('invitations.subtitle', { days: settings.data?.invitation_validity_days ?? 7 })}
        </Text>
      </VStack>
      <Card>
        <VStack gap="md">
          <TextField
            label={t('invitations.label')}
            placeholder={t('invitations.labelPlaceholder')}
            value={label}
            onChangeText={setLabel}
          />
          <Button
            icon="person-add"
            label={t('invitations.create')}
            loading={create.isPending}
            onPress={() => create.mutate()}
            style={{ alignSelf: 'flex-start' }}
          />
        </VStack>
      </Card>
      {list.isLoading ? <LoadingState /> : null}
      {finished.length > 0 ? (
        <Button
          variant="ghost"
          icon="trash-outline"
          label={t('invitations.cleanup', { count: finished.length })}
          loading={remove.isPending}
          onPress={() => void cleanup()}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
      {list.data?.length === 0 ? (
        <EmptyState icon="mail-outline" title={t('invitations.empty')} />
      ) : null}
      {(list.data ?? []).map((inv) => {
        const user = inv.user as { first_name: string | null; last_name: string | null } | null;
        const status = statusOf(inv);
        return (
          <Card key={inv.id}>
            <VStack gap="sm">
              <HStack justify="space-between" wrap>
                <HStack gap="sm">
                  <Text variant="title" tabular style={{ letterSpacing: 2 }}>
                    {inv.code}
                  </Text>
                  {inv.label ? <Text color="textMuted">{inv.label}</Text> : null}
                </HStack>
                <HStack gap="xs">
                  <Badge
                    tone={status === 'valid' ? 'success' : status === 'used' ? 'info' : 'neutral'}
                    label={
                      status === 'used'
                        ? t('invitations.used', {
                            name: user ? fullName(user) : '—',
                            date: formatFrenchDate((inv.used_at as string).slice(0, 10)),
                          })
                        : status === 'revoked'
                          ? t('invitations.revoked')
                          : status === 'expired'
                            ? t('invitations.expired')
                            : t('invitations.valid', {
                                date: formatFrenchDate(inv.expires_at.slice(0, 10)),
                              })
                    }
                  />
                  <IconButton
                    icon="trash-outline"
                    label={t('invitations.delete')}
                    onPress={() => void deleteOne(inv.id, inv.code)}
                  />
                </HStack>
              </HStack>
              {status === 'valid' ? (
                <HStack gap="xs" wrap>
                  <Button
                    variant="secondary"
                    icon="share-outline"
                    label={t('invitations.share')}
                    onPress={() => void share(inv.code)}
                  />
                  <Button
                    variant="secondary"
                    icon="link-outline"
                    label={t('invitations.copyLink')}
                    onPress={() => void copy(invitationLink(inv.code))}
                  />
                  <Button
                    variant="ghost"
                    icon="copy-outline"
                    label={t('invitations.copyCode')}
                    onPress={() => void copy(inv.code)}
                  />
                  <Button
                    variant="ghost"
                    icon="close-circle-outline"
                    label={t('invitations.revoke')}
                    onPress={() => revoke.mutate(inv.id)}
                  />
                </HStack>
              ) : null}
            </VStack>
          </Card>
        );
      })}
    </Screen>
  );
}
