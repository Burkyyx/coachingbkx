import {
  buildPushMessages,
  COACH_GROUP_DELAY_MS,
  type PendingNotification,
} from '../notifications/pushGrouping';

const NOW = Date.parse('2026-11-16T18:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
let n = 0;
const notif = (userId: string, type: string, createdAt: string): PendingNotification => ({
  id: `n${++n}`,
  userId,
  type,
  title: `Titre ${type}`,
  body: `Corps ${n}`,
  data: { adherent_id: 'a1' },
  createdAt,
});

describe('notifications push', () => {
  const tokens = new Map([
    ['coach', ['ExponentPushToken[coach]']],
    ['julie', ['ExponentPushToken[julie-iphone]', 'ExponentPushToken[julie-ipad]']],
  ]);
  const roles = new Map<string, 'coach' | 'adherent'>([
    ['coach', 'coach'],
    ['julie', 'adherent'],
    ['sans-appareil', 'adherent'],
  ]);

  it('envoie une notification adhérent sur chacun de ses appareils', () => {
    const r = buildPushMessages({
      notifications: [notif('julie', 'coach_message', ago(1000))],
      tokensByUser: tokens,
      roleByUser: roles,
      now: NOW,
    });
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0]).toMatchObject({
      title: 'Titre coach_message',
      data: { type: 'coach_message', adherent_id: 'a1' },
      sound: 'default',
    });
    expect(r.doneIds).toHaveLength(1);
  });

  it('regroupe au-delà de 2 notifications adhérent', () => {
    const list = [1, 2, 3].map(() => notif('julie', 'program_updated', ago(1000)));
    const r = buildPushMessages({
      notifications: list,
      tokensByUser: new Map([['julie', ['t']]]),
      roleByUser: roles,
      now: NOW,
    });
    expect(r.messages).toEqual([expect.objectContaining({ title: '3 nouvelles notifications' })]);
  });

  it('attend quelques minutes puis regroupe les notifications du coach', () => {
    const recent = [notif('coach', 'new_message', ago(30_000))];
    expect(
      buildPushMessages({
        notifications: recent,
        tokensByUser: tokens,
        roleByUser: roles,
        now: NOW,
      }),
    ).toEqual({ messages: [], doneIds: [] });

    const old = ago(COACH_GROUP_DELAY_MS + 1000);
    const burst = [
      notif('coach', 'new_message', old),
      notif('coach', 'new_message', old),
      notif('coach', 'new_record', old),
    ];
    const r = buildPushMessages({
      notifications: burst,
      tokensByUser: tokens,
      roleByUser: roles,
      now: NOW,
    });
    expect(r.messages).toEqual([
      expect.objectContaining({ title: 'Activité de tes adhérents', body: '2 messages, 1 record' }),
    ]);
    expect(r.doneIds).toHaveLength(3);
  });

  it('un seul événement coach : message d’origine', () => {
    const r = buildPushMessages({
      notifications: [notif('coach', 'new_checkin', ago(COACH_GROUP_DELAY_MS * 2))],
      tokensByUser: tokens,
      roleByUser: roles,
      now: NOW,
    });
    expect(r.messages[0]).toMatchObject({ title: 'Titre new_checkin' });
  });

  it('sans appareil enregistré : marqué comme traité, rien n’est envoyé', () => {
    const r = buildPushMessages({
      notifications: [notif('sans-appareil', 'coach_message', ago(1000))],
      tokensByUser: tokens,
      roleByUser: roles,
      now: NOW,
    });
    expect(r).toEqual({ messages: [], doneIds: [expect.any(String)] });
  });
});
