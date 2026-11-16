-- =============================================================================
-- 0003 — Suivi coach : règles de progression, suggestions, alertes,
--        bilans hebdomadaires, pesées.
-- =============================================================================

create type public.suggestion_kind as enum (
  'load',         -- changer la charge des séries de travail
  'reps_target',  -- garder la charge, viser +1 rep (objectif affiché à l'adhérent)
  'deload',       -- semaine de décharge (volume réduit)
  'variation',    -- remplacer l'exercice par une variante
  'rep_range',    -- changer la fourchette de répétitions
  'info'          -- simple information au coach (ex. temps de repos)
);
create type public.suggestion_status as enum (
  'pending', 'accepted', 'modified', 'rejected', 'auto_applied', 'reverted'
);
create type public.alert_type as enum (
  'missed_workout', 'inactive', 'stagnation', 'high_fatigue', 'checkin_missing', 'new_record', 'long_rest'
);

-- -----------------------------------------------------------------------------
-- Paramètres des algorithmes (globaux, par adhérent, par exercice ou les deux)
-- Le détail des paramètres est documenté dans src/core/algorithms/rules.ts
-- -----------------------------------------------------------------------------
create table public.progression_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null check (rule_key in ('double_progression', 'stagnation', 'fatigue', 'rest_time')),
  adherent_id uuid references public.profiles (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete cascade,
  params jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  -- « Appliquer automatiquement » : désactivé par défaut (le coach valide).
  auto_apply boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index progression_rules_scope
  on public.progression_rules (rule_key, adherent_id, exercise_id) nulls not distinct;

create trigger progression_rules_updated_at before update on public.progression_rules
  for each row execute function public.set_updated_at();

alter table public.progression_rules enable row level security;

create policy "règles : coach uniquement"
  on public.progression_rules for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- Règles globales par défaut (paramètres vides = valeurs par défaut du code).
insert into public.progression_rules (rule_key) values
  ('double_progression'), ('stagnation'), ('fatigue'), ('rest_time');

-- -----------------------------------------------------------------------------
-- Suggestions de l'algorithme (le coach accepte / modifie / refuse)
-- -----------------------------------------------------------------------------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  kind public.suggestion_kind not null,
  rule_key text not null,
  exercise_id uuid references public.exercises (id) on delete cascade,
  program_id uuid references public.programs (id) on delete cascade,
  current_value jsonb not null default '{}'::jsonb,
  proposed_value jsonb not null default '{}'::jsonb,
  -- Valeur finalement appliquée si le coach a modifié la proposition.
  final_value jsonb,
  -- Justification lisible en français (ex. « 3 séances à 12 reps… → +2,5 kg »).
  justification text not null,
  status public.suggestion_status not null default 'pending',
  -- Évite de proposer deux fois la même chose tant qu'elle est en attente.
  dedupe_key text not null,
  source_session_id uuid references public.session_logs (id) on delete set null,
  -- Modifications réellement faites (pour pouvoir annuler).
  applied_changes jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  reverted_at timestamptz
);

create unique index suggestions_dedupe_pending on public.suggestions (dedupe_key) where status = 'pending';
create index suggestions_queue on public.suggestions (status, created_at desc);
create index suggestions_adherent on public.suggestions (adherent_id, created_at desc);

alter table public.suggestions enable row level security;

create policy "suggestions : coach uniquement"
  on public.suggestions for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- -----------------------------------------------------------------------------
-- Alertes du tableau de bord coach
-- -----------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  type public.alert_type not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

create index alerts_unseen on public.alerts (created_at desc) where seen_at is null;

alter table public.alerts enable row level security;

create policy "alertes : coach uniquement"
  on public.alerts for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- -----------------------------------------------------------------------------
-- Bilans hebdomadaires
-- -----------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  -- Lundi de la semaine concernée.
  week_start date not null check (extract(isodow from week_start) = 1),
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 25 and 350),
  waist_cm numeric(5, 1) check (waist_cm is null or waist_cm between 30 and 250),
  sleep smallint check (sleep between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  -- Chemins des photos (bucket privé "checkin-photos").
  photo_paths text[] not null default '{}',
  comment text,
  coach_reply text,
  coach_replied_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (adherent_id, week_start)
);

create trigger checkins_updated_at before update on public.checkins
  for each row execute function public.set_updated_at();

-- L'adhérent ne peut pas écrire la réponse du coach ; le coach ne modifie que sa réponse.
create or replace function public.protect_checkins()
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
      new.weight_kg is distinct from old.weight_kg or new.waist_cm is distinct from old.waist_cm
      or new.sleep is distinct from old.sleep or new.energy is distinct from old.energy
      or new.stress is distinct from old.stress or new.soreness is distinct from old.soreness
      or new.photo_paths is distinct from old.photo_paths or new.comment is distinct from old.comment
      or new.adherent_id is distinct from old.adherent_id or new.week_start is distinct from old.week_start
    ) then
      raise exception 'Le coach ne peut modifier que sa réponse' using errcode = '42501';
    end if;
    if new.coach_reply is distinct from old.coach_reply then
      new.coach_replied_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.coach_reply := null;
    new.coach_replied_at := null;
  else
    new.coach_reply := old.coach_reply;
    new.coach_replied_at := old.coach_replied_at;
  end if;
  return new;
end;
$$;

create trigger checkins_protect before insert or update on public.checkins
  for each row execute function public.protect_checkins();

alter table public.checkins enable row level security;

create policy "bilans : lecture"
  on public.checkins for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "bilans : création par l'adhérent"
  on public.checkins for insert to authenticated
  with check (adherent_id = (select auth.uid()) and public.is_active_user());
create policy "bilans : modification (adhérent ou réponse du coach)"
  on public.checkins for update to authenticated
  using (public.can_access_adherent(adherent_id))
  with check (public.can_access_adherent(adherent_id));

-- -----------------------------------------------------------------------------
-- Pesées ponctuelles
-- -----------------------------------------------------------------------------
create table public.body_weights (
  id uuid primary key,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 25 and 350),
  created_at timestamptz not null default now(),
  unique (adherent_id, measured_on)
);

alter table public.body_weights enable row level security;

create policy "pesées : lecture"
  on public.body_weights for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "pesées : ajout par l'adhérent"
  on public.body_weights for insert to authenticated
  with check (adherent_id = (select auth.uid()) and public.is_active_user());
create policy "pesées : modification par l'adhérent"
  on public.body_weights for update to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user())
  with check (adherent_id = (select auth.uid()));
create policy "pesées : suppression par l'adhérent"
  on public.body_weights for delete to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user());
