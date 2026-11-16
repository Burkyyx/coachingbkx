-- Fonctions utilitaires pour les tests (créées dans la transaction de chaque test,
-- donc supprimées à la fin). Inclure avec : \ir _helpers.sql
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Crée un utilisateur Auth + son profil. Renvoie son identifiant.
create or replace function tests.create_user(
  p_email text, p_role public.user_role default 'adherent', p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v, p_email);
  insert into public.profiles (id, role, is_active, first_name, onboarded_at)
  values (v, p_role, p_active, split_part(p_email, '@', 1), now());
  return v;
end;
$$;

-- Crée seulement le compte Auth (sans profil), comme après une inscription.
create or replace function tests.create_auth_only(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v, p_email);
  return v;
end;
$$;

-- Se « connecter » en tant qu'utilisateur (rôle authenticated + identifiant JWT).
create or replace function tests.login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.login_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Revenir en super-utilisateur (pour préparer des données).
create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;
