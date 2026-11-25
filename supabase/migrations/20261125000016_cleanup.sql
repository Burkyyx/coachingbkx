-- =============================================================================
-- 0016 — Ménage côté coach : effacer une conversation, supprimer les médias associés.
-- (Les codes d'invitation se suppriment déjà : politique « coach uniquement » sur la table.)
-- =============================================================================

-- Le coach peut supprimer les photos / vidéos de la messagerie (effacement d'une conversation).
create policy "médias messages : suppression par le coach"
  on storage.objects for delete to authenticated
  using (bucket_id = 'message-media' and public.is_coach());

-- Efface tous les messages d'une conversation (le fil reste lié à l'adhérent, vide).
-- Renvoie le nombre de messages supprimés. Coach uniquement.
create or replace function public.clear_conversation(p_conversation uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  delete from public.messages where conversation_id = p_conversation;
  get diagnostics v_count = row_count;
  update public.conversations set last_message_at = null where id = p_conversation;
  return v_count;
end;
$$;
revoke all on function public.clear_conversation(uuid) from public, anon;
grant execute on function public.clear_conversation(uuid) to authenticated;
