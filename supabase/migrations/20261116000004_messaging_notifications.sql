-- =============================================================================
-- 0004 — Messagerie coach ↔ adhérent, notifications, appareils (push).
-- =============================================================================

create type public.message_kind as enum ('text', 'image', 'video');

-- -----------------------------------------------------------------------------
-- Notifications (historique + centre de notifications dans l'app)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Types : session_reminder, program_updated, coach_message, checkin_reminder, checkin_reply,
  --         new_checkin, new_message, new_record, inactivity
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Rempli par la fonction serveur d'envoi des notifications push.
  push_sent_at timestamptz
);

create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_to_push on public.notifications (created_at) where push_sent_at is null;

-- L'utilisateur ne peut que marquer ses notifications comme lues.
create or replace function public.protect_notifications()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (
    new.user_id is distinct from old.user_id or new.type is distinct from old.type
    or new.title is distinct from old.title or new.body is distinct from old.body
    or new.data is distinct from old.data or new.push_sent_at is distinct from old.push_sent_at
  ) then
    raise exception 'Seul le statut « lu » est modifiable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_protect before update on public.notifications
  for each row execute function public.protect_notifications();

alter table public.notifications enable row level security;

create policy "notifications : lecture de ses notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());
create policy "notifications : marquer comme lue"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));

-- Crée une notification en respectant les préférences de l'utilisateur.
-- (préférence absente = activée)
create or replace function public.notify(
  p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefs jsonb;
  v_active boolean;
begin
  select notification_prefs, is_active into v_prefs, v_active from public.profiles where id = p_user;
  if not found or not v_active then
    return;
  end if;
  if coalesce((v_prefs ->> p_type)::boolean, true) = false then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
end;
$$;
revoke all on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where role = 'coach' limit 1;
$$;
revoke all on function public.coach_id() from public;
grant execute on function public.coach_id() to authenticated;

-- Nom affiché d'un adhérent (prénom + initiale du nom).
create or replace function public.display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(trim(coalesce(first_name, '') || ' ' || coalesce(left(last_name, 1) || '.', '')), ''),
    'Un adhérent'
  )
  from public.profiles where id = p_user;
$$;
revoke all on function public.display_name(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Appareils enregistrés pour les notifications push
-- -----------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger push_tokens_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

alter table public.push_tokens enable row level security;

create policy "appareils : gestion de ses propres appareils"
  on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_active_user());

-- -----------------------------------------------------------------------------
-- Conversations (une par adhérent, avec le coach)
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null unique references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "conversations : lecture"
  on public.conversations for select to authenticated
  using (public.can_access_adherent(adherent_id));
create policy "conversations : création par le coach"
  on public.conversations for insert to authenticated with check (public.is_coach());

-- Crée automatiquement la conversation à l'inscription d'un adhérent.
create or replace function public.create_conversation_for_adherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'adherent' then
    insert into public.conversations (adherent_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger profiles_create_conversation after insert on public.profiles
  for each row execute function public.create_conversation_for_adherent();

create or replace function public.can_access_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation and public.can_access_adherent(c.adherent_id)
  );
$$;
revoke all on function public.can_access_conversation(uuid) from public;
grant execute on function public.can_access_conversation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------
create table public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind public.message_kind not null default 'text',
  body text check (body is null or length(body) <= 5000),
  -- Fichier dans le bucket privé "message-media".
  media_path text,
  media_duration_seconds smallint check (media_duration_seconds is null or media_duration_seconds <= 60),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check ((kind = 'text' and body is not null and length(trim(body)) > 0) or (kind <> 'text' and media_path is not null))
);

create index messages_conversation on public.messages (conversation_id, created_at desc);

-- Seul le destinataire peut marquer un message comme lu ; rien d'autre n'est modifiable.
create or replace function public.protect_messages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.conversation_id is distinct from old.conversation_id or new.sender_id is distinct from old.sender_id
     or new.kind is distinct from old.kind or new.body is distinct from old.body
     or new.media_path is distinct from old.media_path or new.created_at is distinct from old.created_at then
    raise exception 'Un message envoyé ne peut pas être modifié' using errcode = '42501';
  end if;
  if new.read_at is distinct from old.read_at and old.sender_id = (select auth.uid()) then
    raise exception 'Seul le destinataire peut marquer le message comme lu' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger messages_protect before update on public.messages
  for each row execute function public.protect_messages();

alter table public.messages enable row level security;

create policy "messages : lecture"
  on public.messages for select to authenticated using (public.can_access_conversation(conversation_id));
create policy "messages : envoi"
  on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_access_conversation(conversation_id));
create policy "messages : marquer comme lu"
  on public.messages for update to authenticated
  using (public.can_access_conversation(conversation_id))
  with check (public.can_access_conversation(conversation_id));

-- Après un message : date du dernier message + notification du destinataire.
create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adherent uuid;
  v_preview text;
begin
  select adherent_id into v_adherent from public.conversations where id = new.conversation_id;
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  v_preview := case new.kind
    when 'text' then left(new.body, 120)
    when 'image' then '📷 Photo'
    else '🎥 Vidéo'
  end;
  if new.sender_id = v_adherent then
    perform public.notify(
      public.coach_id(), 'new_message', 'Message de ' || public.display_name(v_adherent), v_preview,
      jsonb_build_object('adherent_id', v_adherent, 'conversation_id', new.conversation_id)
    );
  else
    perform public.notify(
      v_adherent, 'coach_message', 'Message de ton coach', v_preview,
      jsonb_build_object('conversation_id', new.conversation_id)
    );
  end if;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_created();

-- Diffusion en temps réel des messages (Supabase Realtime).
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
