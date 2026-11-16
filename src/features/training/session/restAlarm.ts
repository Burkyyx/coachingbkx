import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Alerte de fin de repos :
 *  - iPhone / Android : notification locale programmée (fonctionne app en arrière-plan)
 *    + vibration si l'app est ouverte ;
 *  - web : notification du navigateur si autorisée + vibration (Android).
 */

let scheduledId: string | null = null;
let webTimer: ReturnType<typeof setTimeout> | null = null;

const TITLE = 'Repos terminé ⏱';
const BODY = 'C’est reparti : série suivante !';

export async function requestRestAlarmPermission() {
  try {
    if (Platform.OS === 'web') {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) await Notifications.requestPermissionsAsync();
  } catch {
    // Pas bloquant : le minuteur fonctionne aussi sans notification.
  }
}

export async function scheduleRestAlarm(endsAt: number) {
  await cancelRestAlarm();
  const seconds = Math.max(1, Math.round((endsAt - Date.now()) / 1000));
  if (Platform.OS === 'web') {
    webTimer = setTimeout(() => {
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
          navigator.vibrate([200, 100, 200]);
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'granted' &&
          document.hidden
        ) {
          new Notification(TITLE, { body: BODY });
        }
      } catch {
        // ignoré
      }
    }, seconds * 1000);
    return;
  }
  try {
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title: TITLE, body: BODY, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {
    scheduledId = null;
  }
}

export async function cancelRestAlarm() {
  if (webTimer) clearTimeout(webTimer);
  webTimer = null;
  if (scheduledId) {
    const id = scheduledId;
    scheduledId = null;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
}

/** Retour tactile (vibration courte) — sans effet sur le web. */
export function tap(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light')
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  else
    void Haptics.notificationAsync(
      kind === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
}
