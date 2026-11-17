// -----------------------------------------------------------------------------
// Edge Function « delete-account » : suppression DÉFINITIVE du compte de
// l'utilisateur connecté (exigence App Store / RGPD) :
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
  if (caller.role === 'coach')
    return json({ error: 'Le compte coach ne peut pas être supprimé ici.' }, 403);

  let removed = 0;
  for (const bucket of ['avatars', 'checkin-photos', 'message-media']) {
    removed += (await removeFolder(db, bucket, caller.userId)).length;
  }
  const { error } = await db.auth.admin.deleteUser(caller.userId);
  if (error) {
    const d = errorDetail(error);
    log('suppression de compte en échec', d);
    return json({ error: 'Suppression impossible', ...d }, 500);
  }
  log('compte supprimé', { files: removed });
  return json({ deleted: true });
});
