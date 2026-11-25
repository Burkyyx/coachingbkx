// -----------------------------------------------------------------------------
// Edge Function « delete-account » : suppression DÉFINITIVE d'un compte
//  - par l'adhérent lui-même (exigence App Store / RGPD) ;
//  - ou par le coach, pour un adhérent ({ adherent_id }) :
//  1. suppression de ses fichiers (avatar, photos de bilan, médias de messagerie) ;
//  2. suppression du compte Auth → toutes ses données sont effacées en cascade.
// Le compte coach ne peut pas être supprimé depuis l'app (sécurité).
// -----------------------------------------------------------------------------
import {
  adminClient,
  corsHeaders,
  errorDetail,
  identifyCaller,
  json,
  log,
} from '../_shared/admin.ts';

async function removeFolder(db: ReturnType<typeof adminClient>, bucket: string, prefix: string) {
  // Parcourt les sous-dossiers (ex. checkin-photos/<id>/<bilan>/photo.jpg).
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) files.push(...(await removeFolder(db, bucket, path)));
    else files.push(path);
  }
  if (files.length) await db.storage.from(bucket).remove(files);
  return files;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = adminClient();
  const caller = await identifyCaller(req, db);
  if (caller?.kind !== 'user') return json({ error: 'Non autorisé' }, 401);

  // Le coach peut supprimer définitivement un adhérent ({ adherent_id }) ;
  // un adhérent ne peut supprimer que son propre compte.
  const body = (await req.json().catch(() => ({}))) as { adherent_id?: unknown };
  let target = caller.userId;
  if (caller.role === 'coach') {
    if (typeof body.adherent_id !== 'string')
      return json({ error: 'Le compte coach ne peut pas être supprimé ici.' }, 403);
    const { data: profile } = await db
      .from('profiles')
      .select('role')
      .eq('id', body.adherent_id)
      .maybeSingle();
    if (profile?.role !== 'adherent') return json({ error: 'Adhérent introuvable' }, 404);
    target = body.adherent_id;
  }

  let removed = 0;
  for (const bucket of ['avatars', 'checkin-photos', 'message-media', 'meal-photos']) {
    removed += (await removeFolder(db, bucket, target)).length;
  }
  const { error } = await db.auth.admin.deleteUser(target);
  if (error) {
    const d = errorDetail(error);
    log('suppression de compte en échec', d);
    return json({ error: 'Suppression impossible', ...d }, 500);
  }
  log('compte supprimé', { files: removed, by: caller.role });
  return json({ deleted: true });
});
