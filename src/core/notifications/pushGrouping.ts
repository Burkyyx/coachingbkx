/**
 * Préparation des notifications push (logique pure, testée).
 *  - adhérent : notifications envoyées une par une (au plus 2, sinon regroupées) ;
 *  - coach : regroupées pour ne pas spammer (on attend quelques minutes pour
 *    rassembler les événements, puis un seul message récapitulatif).
 */

export type PendingNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
};

/** Libellés des types pour les récapitulatifs du coach. */
const COACH_LABELS: Record<string, [string, string]> = {
  new_message: ['message', 'messages'],
  new_checkin: ['bilan', 'bilans'],
  new_record: ['record', 'records'],
  inactivity: ['alerte d’inactivité', 'alertes d’inactivité'],
};

/** Délai de regroupement des notifications du coach. */
export const COACH_GROUP_DELAY_MS = 3 * 60 * 1000;

export function buildPushMessages(args: {
  notifications: readonly PendingNotification[];
  tokensByUser: ReadonlyMap<string, readonly string[]>;
  roleByUser: ReadonlyMap<string, 'coach' | 'adherent'>;
  now: number;
}): { messages: PushMessage[]; doneIds: string[] } {
  const byUser = new Map<string, PendingNotification[]>();
  for (const n of args.notifications) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);

  const messages: PushMessage[] = [];
  const doneIds: string[] = [];
  for (const [userId, list] of byUser) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const isCoach = args.roleByUser.get(userId) === 'coach';
    const oldest = sorted[0];
    // Coach : on attend un peu pour regrouper les événements proches.
    if (isCoach && oldest && args.now - Date.parse(oldest.createdAt) < COACH_GROUP_DELAY_MS)
      continue;

    doneIds.push(...sorted.map((n) => n.id));
    const tokens = args.tokensByUser.get(userId) ?? [];
    if (tokens.length === 0) continue;

    let payloads: { title: string; body: string; data: Record<string, unknown> }[];
    if (sorted.length <= (isCoach ? 1 : 2)) {
      payloads = sorted.map((n) => ({
        title: n.title,
        body: n.body,
        data: { ...n.data, type: n.type },
      }));
    } else if (isCoach) {
      const counts = new Map<string, number>();
      for (const n of sorted) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
      const parts = [...counts.entries()].map(([type, count]) => {
        const [one, many] = COACH_LABELS[type] ?? ['notification', 'notifications'];
        return `${count} ${count > 1 ? many : one}`;
      });
      payloads = [
        {
          title: 'Activité de tes adhérents',
          body: parts.join(', '),
          data: { type: 'inactivity' },
        },
      ];
    } else {
      const last = sorted[sorted.length - 1] as PendingNotification;
      payloads = [
        {
          title: `${sorted.length} nouvelles notifications`,
          body: last.body,
          data: { ...last.data, type: last.type },
        },
      ];
    }
    for (const token of tokens) {
      for (const p of payloads) messages.push({ to: token, ...p, sound: 'default' });
    }
  }
  return { messages, doneIds };
}
