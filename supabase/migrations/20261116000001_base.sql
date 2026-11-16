-- =============================================================================
-- 0001 — Socle : types, fonctions utilitaires, profils, réglages, invitations,
--        consentements, notes privées du coach.
-- =============================================================================
-- Conventions :
--   * toutes les tables ont la RLS activée (row level security) ;
--   * le coach (unique) a accès à tout via public.is_coach() ;
--   * un adhérent n'accède qu'à ses propres lignes, et seulement si son compte est actif.

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('coach', 'adherent');
create type public.sex as enum ('male', 'female', 'other');
create type public.training_level as enum ('beginner', 'intermediate', 'advanced');
create type public.training_goal as enum ('muscle_gain', 'fat_loss', 'recomposition', 'performance', 'health');
create type public.effort_scale as enum ('rir', 'rpe');
create type public.consent_type as enum ('terms', 'training_data', 'health_data', 'ai_photo', 'community');

-- -----------------------------------------------------------------------------
-- Fonction : mise à jour automatique de updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profils (1 ligne par compte ; id = auth.users.id)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'adherent',
  first_name text,
  last_name text,
  nickname text,
  birth_date date,
  sex public.sex,
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 80 and 260),
  level public.training_level,
  goal public.training_goal,
  -- Blessures / contraintes : visibles uniquement par l'adhérent lui-même et le coach.
  injuries text,
  avatar_path text,
  -- Échelle d'effort utilisée en séance (réglée par le coach pour chaque adhérent).
  effort_scale public.effort_scale not null default 'rir',
  -- Jour du bilan hebdo (1 = lundi … 7 = dimanche). Null = valeur par défaut du coach.
  checkin_weekday smallint check (checkin_weekday between 1 and 7),
  -- Compte actif ? Un adhérent désactivé conserve ses données mais n'a plus accès.
  is_active boolean not null default true,
  onboarded_at timestamptz,
  -- Préférences de notifications : { "session_reminder": true, "rest_timer": true, ... }
  notification_prefs jsonb not null default '{}'::jsonb,
  timezone text not null default 'Europe/Paris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil de chaque utilisateur (coach ou adhérent).';

-- Un seul coach possible.
create unique index profiles_single_coach on public.profiles (role) where role = 'coach';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation (SECURITY DEFINER pour éviter la récursion RLS)
-- -----------------------------------------------------------------------------
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'coach' and is_active
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and is_active
  );
$$;

-- Vrai si l'utilisateur courant est l'adhérent `p_adherent` (actif) ou le coach.
create or replace function public.can_access_adherent(p_adherent uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_coach()
      or (p_adherent = (select auth.uid()) and public.is_active_user());
$$;

revoke all on function public.is_coach() from public;
revoke all on function public.is_active_user() from public;
revoke all on function public.can_access_adherent(uuid) from public;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.can_access_adherent(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Profils : protections et politiques
-- -----------------------------------------------------------------------------
-- Un adhérent ne peut pas modifier son rôle, son statut actif, ni les réglages
-- décidés par le coach (échelle d'effort, jour de bilan).
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Appels serveur (service_role / migrations) ou coach : tout est permis.
  if (select auth.uid()) is null or public.is_coach() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.effort_scale is distinct from old.effort_scale
     or new.checkin_weekday is distinct from old.checkin_weekday
     or new.created_at is distinct from old.created_at then
    raise exception 'Modification non autorisée de ce champ du profil'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

alter table public.profiles enable row level security;

create policy "profil : lecture par soi-même ou le coach"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_coach());

create policy "profil : mise à jour par soi-même (actif) ou le coach"
  on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and is_active) or public.is_coach())
  with check ((id = (select auth.uid()) and is_active) or public.is_coach());

-- Pas d'insertion ni de suppression directes : création via redeem_invitation()
-- et suppression via la fonction serveur de suppression de compte.

-- -----------------------------------------------------------------------------
-- Réglages globaux du coach (une seule ligne)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  -- Alerte « adhérent inactif » après X jours sans séance.
  inactivity_days smallint not null default 5 check (inactivity_days between 1 and 60),
  -- Jour du bilan hebdo par défaut (1 = lundi … 7 = dimanche).
  default_checkin_weekday smallint not null default 7 check (default_checkin_weekday between 1 and 7),
  -- Durée de validité des codes d'invitation (jours).
  invitation_validity_days smallint not null default 7 check (invitation_validity_days between 1 and 90),
  -- Heure (locale) des rappels de séance et de bilan.
  session_reminder_hour smallint not null default 8 check (session_reminder_hour between 0 and 23),
  checkin_reminder_hour smallint not null default 18 check (checkin_reminder_hour between 0 and 23),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

create policy "réglages : lecture par les utilisateurs actifs"
  on public.app_settings for select to authenticated
  using (public.is_active_user());

create policy "réglages : modification par le coach"
  on public.app_settings for update to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- -----------------------------------------------------------------------------
-- Notes privées du coach sur un adhérent (jamais visibles par l'adhérent)
-- -----------------------------------------------------------------------------
create table public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_notes_adherent on public.coach_notes (adherent_id, created_at desc);

create trigger coach_notes_updated_at before update on public.coach_notes
  for each row execute function public.set_updated_at();

alter table public.coach_notes enable row level security;

create policy "notes coach : coach uniquement"
  on public.coach_notes for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- -----------------------------------------------------------------------------
-- Invitations
-- -----------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  -- Libellé libre pour s'y retrouver (ex. « Julie M. »).
  label text,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;

create policy "invitations : coach uniquement"
  on public.invitations for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- Génère un code d'invitation à usage unique (coach uniquement).
-- Alphabet sans caractères ambigus (pas de 0/O, 1/I/L).
create or replace function public.create_invitation(p_label text default null)
returns public.invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_bytes bytea;
  v_days smallint;
  v_row public.invitations;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select invitation_validity_days into v_days from public.app_settings where id = 1;
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.invitations where code = v_code);
  end loop;
  insert into public.invitations (code, label, created_by, expires_at)
  values (v_code, nullif(trim(p_label), ''), (select auth.uid()), now() + make_interval(days => v_days))
  returning * into v_row;
  return v_row;
end;
$$;

-- Vérifie qu'un code est utilisable (appelable avant la création du compte).
create or replace function public.check_invitation(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invitations
    where code = upper(trim(p_code))
      and used_at is null and revoked_at is null and expires_at > now()
  );
$$;

-- Utilise un code : crée le profil adhérent du compte connecté.
create or replace function public.redeem_invitation(p_code text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if found then
    return v_profile; -- déjà inscrit : rien à faire
  end if;

  select * into v_inv from public.invitations
  where code = upper(trim(p_code))
    and used_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'invitation_invalide' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, role) values (v_uid, 'adherent')
  returning * into v_profile;

  update public.invitations set used_by = v_uid, used_at = now() where id = v_inv.id;
  return v_profile;
end;
$$;

-- Crée le compte coach à partir d'un utilisateur Auth existant (à lancer une seule fois
-- depuis l'éditeur SQL de Supabase, voir README). Non appelable depuis l'app.
create or replace function public.bootstrap_coach(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_profile public.profiles;
begin
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'Aucun compte avec cet e-mail : crée-le d''abord dans Authentication > Users';
  end if;
  insert into public.profiles (id, role, onboarded_at)
  values (v_uid, 'coach', now())
  on conflict (id) do update set role = 'coach', is_active = true
  returning * into v_profile;
  return v_profile;
end;
$$;

revoke all on function public.create_invitation(text) from public;
revoke all on function public.check_invitation(text) from public;
revoke all on function public.redeem_invitation(text) from public;
revoke all on function public.bootstrap_coach(text) from public, anon, authenticated;
grant execute on function public.create_invitation(text) to authenticated;
grant execute on function public.check_invitation(text) to anon, authenticated;
grant execute on function public.redeem_invitation(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Consentements (RGPD) — versionnés et révocables
-- -----------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.consent_type not null,
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Un seul consentement actif par type.
create unique index consents_one_active on public.consents (user_id, type) where revoked_at is null;

-- Seule la révocation est modifiable ; une fois révoqué, on ne revient pas en arrière
-- (il faut accorder un nouveau consentement).
create or replace function public.protect_consents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.version is distinct from old.version
     or new.granted_at is distinct from old.granted_at
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'Seule la révocation d''un consentement est possible' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger consents_protect before update on public.consents
  for each row execute function public.protect_consents();

alter table public.consents enable row level security;

create policy "consentements : lecture par soi-même ou le coach"
  on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or public.is_coach());

create policy "consentements : accord par soi-même"
  on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_user());

create policy "consentements : révocation par soi-même"
  on public.consents for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user())
  with check (user_id = (select auth.uid()));
