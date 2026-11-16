// -----------------------------------------------------------------------------
// Edge Function « send-push » : envoie les notifications push en attente
// (service Expo Push), regroupées pour le coach. Appelée chaque minute par la
// tâche planifiée (en-tête x-cron-secret).
// -----------------------------------------------------------------------------
import { buildPushMessages, type PendingNotification } from '../_shared/core/index.ts';
import { adminClient, corsHeaders, identifyCaller, json, log } from '../_shared/admin.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = adminClient();
  const caller = await identifyCaller(req, db);
  if (caller?.kind !== 'cron') return json({ error: 'Non autorisé' }, 401);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: rows, error } = await db
    .from('notifications')
    .select('id, user_id, type, title, body, data, created_at')
    .is('push_sent_at', null)
    .gte('created_at', since)
    .order('created_at')
    .limit(500);
  if (error) return json({ error: 'Lecture impossible' }, 500);
  if (!rows?.length) return json({ sent: 0 });

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: tokens }, { data: profiles }] = await Promise.all([
    db.from('push_tokens').select('token, user_id').in('user_id', userIds),
    db.from('profiles').select('id, role').in('id', userIds),
  ]);
  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? [])
    tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
  const roleByUser = new Map((profiles ?? []).map((p) => [p.id, p.role as 'coach' | 'adherent']));

  const notifications: PendingNotification[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: (r.data ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
  const { messages, doneIds } = buildPushMessages({
    notifications,
    tokensByUser,
    roleByUser,
    now: Date.now(),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      });
      const body = (await res.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      for (const [j, ticket] of (body.data ?? []).entries()) {
        if (ticket.status === 'ok') sent++;
        // Appareil désinstallé : on oublie son jeton.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await db
            .from('push_tokens')
            .delete()
            .eq('token', chunk[j]?.to ?? '');
        }
      }
    } catch {
      log('envoi push en échec');
    }
  }
  if (doneIds.length) {
    await db
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .in('id', doneIds);
  }
  log('push envoyés', { sent, processed: doneIds.length });
  return json({ sent, processed: doneIds.length });
});
