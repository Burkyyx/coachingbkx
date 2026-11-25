-- -----------------------------------------------------------------------------
-- Suppression de séances par le coach (même en cours).
--  - delete_session_log(id) : réservée au coach ; supprime la séance, ses séries
--    (cascade) et les records obtenus pendant cette séance.
--  - deleted_session_logs : trace des séances supprimées, pour que le téléphone de
--    l'adhérent (séance en cours, synchronisation en attente) ne la recrée pas et
--    abandonne sa séance locale.
-- -----------------------------------------------------------------------------
create table public.deleted_session_logs (
  id uuid primary key,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  deleted_at timestamptz not null default now()
);
create index deleted_session_logs_adherent on public.deleted_session_logs (adherent_id);

alter table public.deleted_session_logs enable row level security;
create policy "séances supprimées : lecture"
  on public.deleted_session_logs for select to authenticated
  using (public.can_access_adherent(adherent_id));
-- Aucune écriture directe : uniquement par delete_session_log().

-- Une séance supprimée par le coach ne peut pas être recréée par la synchronisation.
drop policy "séances réalisées : création par l'adhérent" on public.session_logs;
create policy "séances réalisées : création par l'adhérent"
  on public.session_logs for insert to authenticated
  with check (
    adherent_id = (select auth.uid())
    and public.is_active_user()
    and not exists (select 1 from public.deleted_session_logs d where d.id = session_logs.id)
  );

create or replace function public.delete_session_log(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adherent uuid;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select adherent_id into v_adherent from public.session_logs where id = p_id;
  if not found then
    raise exception 'Séance introuvable';
  end if;
  insert into public.deleted_session_logs (id, adherent_id) values (p_id, v_adherent)
  on conflict (id) do nothing;
  delete from public.personal_records where session_log_id = p_id;
  delete from public.session_logs where id = p_id; -- séries supprimées en cascade
end;
$$;
revoke all on function public.delete_session_log(uuid) from public, anon;
grant execute on function public.delete_session_log(uuid) to authenticated;
