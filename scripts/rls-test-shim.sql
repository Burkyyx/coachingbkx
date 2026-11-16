-- -----------------------------------------------------------------------------
-- Mise à niveau de l'image Postgres Supabase « nue » utilisée pour les tests RLS,
-- afin qu'elle se comporte comme un vrai projet Supabase sur les points testés.
-- (Ne concerne QUE l'environnement de test, jamais la production.)
-- -----------------------------------------------------------------------------

-- auth.uid() moderne : lit l'identifiant dans request.jwt.claims.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

-- Colonnes récentes de storage.buckets.
alter table storage.buckets add column if not exists public boolean default false;
alter table storage.buckets add column if not exists file_size_limit bigint;
alter table storage.buckets add column if not exists allowed_mime_types text[];

alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant usage on schema storage to authenticated, anon;

create extension if not exists pgtap with schema extensions;
