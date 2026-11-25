-- =============================================================================
-- 0015 — PHASE 2 : Nutrition
--   nutrition_targets : objectifs fixés par le coach (+ réglages : suivi des calories, limite IA)
--   meals / meal_items : journal alimentaire (identifiants générés sur l'appareil : hors-ligne)
--   ai_usage           : suivi des analyses photo (contrôle des coûts), écrit par le serveur
--   meal-photos        : bucket privé des photos de repas
-- Données nutritionnelles STRICTEMENT privées entre l'adhérent et le coach.
-- =============================================================================

create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack');
create type public.meal_source as enum ('photo_ai', 'barcode', 'quick', 'manual', 'copy');
create type public.meal_analysis_status as enum ('none', 'pending', 'done', 'failed');
create type public.ai_confidence as enum ('low', 'medium', 'high');

-- -----------------------------------------------------------------------------
-- Objectifs et réglages nutrition (1 ligne par adhérent, écrite par le coach)
-- -----------------------------------------------------------------------------
create table public.nutrition_targets (
  adherent_id uuid primary key references public.profiles (id) on delete cascade,
  -- Faux = suivi « photos seulement », sans chiffres (choix du coach).
  calories_enabled boolean not null default true,
  -- Limite d'analyses photo par jour (contrôle des coûts).
  ai_daily_limit smallint not null default 10 check (ai_daily_limit between 0 and 50),
  kcal integer check (kcal is null or kcal between 800 and 8000),
  protein_g integer check (protein_g is null or protein_g between 0 and 600),
  carbs_g integer check (carbs_g is null or carbs_g between 0 and 1500),
  fat_g integer check (fat_g is null or fat_g between 0 and 500),
  -- Plancher (garde-fou des suggestions) : par défaut le métabolisme de base.
  floor_kcal integer check (floor_kcal is null or floor_kcal between 800 and 4000),
  -- NAP forcé par le coach (sinon déduit du niveau d'activité).
  nap_override numeric(3, 2) check (nap_override is null or nap_override between 1.1 and 2.5),
  -- Vitesse visée de la tendance de poids, en % du poids par semaine (ex. −0,5).
  weekly_rate_target numeric(4, 2) check (weekly_rate_target is null or weekly_rate_target between -1 and 1),
  coach_note text check (coach_note is null or char_length(coach_note) <= 1000),
  updated_at timestamptz not null default now()
);

create trigger nutrition_targets_updated_at before update on public.nutrition_targets
  for each row execute function public.set_updated_at();

alter table public.nutrition_targets enable row level security;
create policy "objectifs nutrition : lecture"
  on public.nutrition_targets for select to authenticated
  using (public.can_access_adherent(adherent_id));
create policy "objectifs nutrition : écriture par le coach"
  on public.nutrition_targets for insert to authenticated with check (public.is_coach());
create policy "objectifs nutrition : modification par le coach"
  on public.nutrition_targets for update to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "objectifs nutrition : suppression par le coach"
  on public.nutrition_targets for delete to authenticated using (public.is_coach());

-- -----------------------------------------------------------------------------
-- Repas
-- -----------------------------------------------------------------------------
create table public.meals (
  id uuid primary key,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  eaten_at timestamptz not null,
  meal_type public.meal_type not null,
  photo_path text,
  description text check (description is null or char_length(description) <= 1000),
  source public.meal_source not null default 'manual',
  analysis_status public.meal_analysis_status not null default 'none',
  analysis_note text check (analysis_note is null or char_length(analysis_note) <= 500),
  kcal numeric(7, 1) not null default 0 check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  validated boolean not null default false,
  is_favorite boolean not null default false,
  coach_comment text check (coach_comment is null or char_length(coach_comment) <= 1000),
  coach_commented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_adherent_eaten on public.meals (adherent_id, eaten_at desc);

create trigger meals_updated_at before update on public.meals
  for each row execute function public.set_updated_at();

-- L'adhérent ne touche pas au commentaire du coach ; le coach ne modifie QUE son commentaire.
create or replace function public.protect_meals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if public.is_coach() then
    if tg_op = 'UPDATE' and (
      (to_jsonb(new) - array['coach_comment', 'coach_commented_at', 'updated_at'])
        is distinct from (to_jsonb(old) - array['coach_comment', 'coach_commented_at', 'updated_at'])
    ) then
      raise exception 'Le coach ne peut modifier que son commentaire' using errcode = '42501';
    end if;
    if new.coach_comment is distinct from old.coach_comment then
      new.coach_commented_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.coach_comment := null;
    new.coach_commented_at := null;
  else
    new.coach_comment := old.coach_comment;
    new.coach_commented_at := old.coach_commented_at;
    new.adherent_id := old.adherent_id;
  end if;
  return new;
end;
$$;
create trigger meals_protect before insert or update on public.meals
  for each row execute function public.protect_meals();

alter table public.meals enable row level security;
create policy "repas : lecture"
  on public.meals for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "repas : création par l'adhérent"
  on public.meals for insert to authenticated
  with check (adherent_id = (select auth.uid()) and public.is_active_user());
create policy "repas : modification (adhérent ou commentaire du coach)"
  on public.meals for update to authenticated
  using (public.can_access_adherent(adherent_id))
  with check (public.can_access_adherent(adherent_id));
create policy "repas : suppression par l'adhérent"
  on public.meals for delete to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user());

-- -----------------------------------------------------------------------------
-- Aliments d'un repas
-- -----------------------------------------------------------------------------
create table public.meal_items (
  id uuid primary key,
  meal_id uuid not null references public.meals (id) on delete cascade,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  quantity_g numeric(6, 1) check (quantity_g is null or quantity_g between 0 and 5000),
  kcal numeric(7, 1) not null default 0 check (kcal >= 0),
  protein_g numeric(6, 1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6, 1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6, 1) not null default 0 check (fat_g >= 0),
  confidence public.ai_confidence,
  barcode text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  created_at timestamptz not null default now()
);
create index meal_items_meal on public.meal_items (meal_id, position);

-- Cohérence : l'aliment appartient au même adhérent que son repas.
create or replace function public.check_meal_item_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.meals m where m.id = new.meal_id and m.adherent_id = new.adherent_id) then
    raise exception 'Repas introuvable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger meal_items_owner before insert or update on public.meal_items
  for each row execute function public.check_meal_item_owner();

alter table public.meal_items enable row level security;
create policy "aliments : lecture"
  on public.meal_items for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "aliments : création par l'adhérent"
  on public.meal_items for insert to authenticated
  with check (adherent_id = (select auth.uid()) and public.is_active_user());
create policy "aliments : modification par l'adhérent"
  on public.meal_items for update to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user())
  with check (adherent_id = (select auth.uid()));
create policy "aliments : suppression par l'adhérent"
  on public.meal_items for delete to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user());

-- -----------------------------------------------------------------------------
-- Suivi des analyses IA (écrit uniquement par l'Edge Function, clé serveur)
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  meal_id uuid references public.meals (id) on delete set null,
  model text not null,
  status text not null check (status in ('ok', 'invalid', 'error')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_adherent_day on public.ai_usage (adherent_id, created_at desc);

alter table public.ai_usage enable row level security;
create policy "consommation IA : lecture"
  on public.ai_usage for select to authenticated using (public.can_access_adherent(adherent_id));
-- Aucune politique d'écriture : seules les fonctions serveur (service_role) écrivent.

-- Analyses restantes aujourd'hui (heure de Paris) pour l'adhérent connecté.
create or replace function public.ai_analyses_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    coalesce((select t.ai_daily_limit from public.nutrition_targets t where t.adherent_id = (select auth.uid())), 10)
    - (select count(*)::integer from public.ai_usage u
       where u.adherent_id = (select auth.uid())
         and u.status in ('ok', 'invalid')
         and (u.created_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date)
  );
$$;
revoke all on function public.ai_analyses_left() from public, anon;
grant execute on function public.ai_analyses_left() to authenticated;

-- -----------------------------------------------------------------------------
-- Photos de repas : bucket privé  meal-photos/<adherent_id>/<meal_id>.jpg
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos repas : lecture (soi-même ou coach)"
  on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and public.can_access_adherent(public.storage_owner(name)));
create policy "photos repas : envoi par soi-même"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and public.storage_owner(name) = (select auth.uid()) and public.is_active_user());
create policy "photos repas : suppression par soi-même"
  on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and public.storage_owner(name) = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Export RGPD : ajoute les données nutrition
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from public.consents c where c.user_id = v_uid), '[]'),
    'programs', coalesce((select jsonb_agg(to_jsonb(p)) from public.programs p where p.adherent_id = v_uid), '[]'),
    'session_logs', coalesce((select jsonb_agg(to_jsonb(s) order by s.started_at) from public.session_logs s where s.adherent_id = v_uid), '[]'),
    'set_logs', coalesce((select jsonb_agg(
        to_jsonb(sl) || jsonb_build_object('exercise_name', e.name) order by sl.performed_at)
      from public.set_logs sl join public.exercises e on e.id = sl.exercise_id where sl.adherent_id = v_uid), '[]'),
    'personal_records', coalesce((select jsonb_agg(to_jsonb(r)) from public.personal_records r where r.adherent_id = v_uid), '[]'),
    'checkins', coalesce((select jsonb_agg(to_jsonb(c) order by c.week_start) from public.checkins c where c.adherent_id = v_uid), '[]'),
    'body_weights', coalesce((select jsonb_agg(to_jsonb(b) order by b.measured_on) from public.body_weights b where b.adherent_id = v_uid), '[]'),
    'reference_1rm', coalesce((select jsonb_agg(to_jsonb(r)) from public.reference_1rm r where r.adherent_id = v_uid), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at)
      from public.messages m join public.conversations c on c.id = m.conversation_id where c.adherent_id = v_uid), '[]'),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notifications n where n.user_id = v_uid), '[]'),
    'nutrition_targets', (select to_jsonb(t) from public.nutrition_targets t where t.adherent_id = v_uid),
    'meals', coalesce((select jsonb_agg(to_jsonb(m) order by m.eaten_at) from public.meals m where m.adherent_id = v_uid), '[]'),
    'meal_items', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from public.meal_items i where i.adherent_id = v_uid), '[]'),
    'ai_usage', coalesce((select jsonb_agg(to_jsonb(u) - 'cost_usd' order by u.created_at) from public.ai_usage u where u.adherent_id = v_uid), '[]')
  );
end;
$$;
revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;
