-- =============================================================================
-- 0006 — Stockage des fichiers (buckets PRIVÉS, accès par URL signées).
-- =============================================================================
-- Convention de chemins : le premier dossier est l'identifiant du propriétaire.
--   avatars/<user_id>/avatar-<horodatage>.jpg
--   exercise-media/<exercise_id>/<fichier>            (vidéos de démonstration, coach)
--   checkin-photos/<adherent_id>/<checkin_id>/<n>.jpg (photos de progression)
--   message-media/<adherent_id>/<message_id>.<ext>    (photos / vidéos de la messagerie)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('exercise-media', 'exercise-media', false, 52428800, array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']),
  ('checkin-photos', 'checkin-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('message-media', 'message-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- Extrait l'identifiant propriétaire (1er dossier) d'un chemin ; null si invalide.
create or replace function public.storage_owner(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  if v_first ~ '^[0-9a-fA-F-]{36}$' then
    return v_first::uuid;
  end if;
  return null;
end;
$$;

-- Avatars
create policy "avatars : lecture (soi-même ou coach)"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_access_adherent(public.storage_owner(name)));
create policy "avatars : envoi par soi-même"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.storage_owner(name) = (select auth.uid()) and public.is_active_user());
create policy "avatars : remplacement par soi-même"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.storage_owner(name) = (select auth.uid()));
create policy "avatars : suppression par soi-même"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.storage_owner(name) = (select auth.uid()));

-- Vidéos de démonstration des exercices
create policy "médias exercices : lecture par les utilisateurs actifs"
  on storage.objects for select to authenticated
  using (bucket_id = 'exercise-media' and public.is_active_user());
create policy "médias exercices : envoi par le coach"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-media' and public.is_coach());
create policy "médias exercices : modification par le coach"
  on storage.objects for update to authenticated
  using (bucket_id = 'exercise-media' and public.is_coach());
create policy "médias exercices : suppression par le coach"
  on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-media' and public.is_coach());

-- Photos de progression des bilans (strictement privées : adhérent + coach)
create policy "photos bilan : lecture (adhérent ou coach)"
  on storage.objects for select to authenticated
  using (bucket_id = 'checkin-photos' and public.can_access_adherent(public.storage_owner(name)));
create policy "photos bilan : envoi par l'adhérent"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-photos' and public.storage_owner(name) = (select auth.uid()) and public.is_active_user());
create policy "photos bilan : suppression par l'adhérent"
  on storage.objects for delete to authenticated
  using (bucket_id = 'checkin-photos' and public.storage_owner(name) = (select auth.uid()));

-- Médias de la messagerie (dossier = adhérent de la conversation)
create policy "médias messages : lecture (adhérent ou coach)"
  on storage.objects for select to authenticated
  using (bucket_id = 'message-media' and public.can_access_adherent(public.storage_owner(name)));
create policy "médias messages : envoi (adhérent ou coach)"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'message-media' and public.can_access_adherent(public.storage_owner(name)));
