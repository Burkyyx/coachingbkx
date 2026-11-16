import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import { targetOf } from './api';

/**
 * Notifications push (iPhone / Android).
 * Nécessitent une version installée via EAS (pas Expo Go) et un projet EAS
 * (EAS_PROJECT_ID). Sur le web, seules les notifications dans l'app sont utilisées.
 */

// Affichage des notifications quand l'app est ouverte.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function registerPushToken(uid: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  if (!projectId) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      importance: AndroidImportance.HIGH,
    });
  }
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase
    .from('push_tokens')
    .upsert({ token, user_id: uid, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
}

/** Enregistre l'appareil et ouvre le bon écran quand on touche une notification. */
export function usePushNotifications(uid: string | null) {
  useEffect(() => {
    if (!uid) return;
    void registerPushToken(uid).catch(() => undefined);
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const content = response.notification.request.content;
      const data = (content.data ?? {}) as { type?: string } & Record<string, unknown>;
      if (!data.type) return;
      const target = targetOf({ type: data.type, data: data as never });
      if (target) router.push(target);
    });
    return () => sub.remove();
  }, [uid]);
}
