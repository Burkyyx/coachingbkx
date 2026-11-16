-- =============================================================================
-- 0002 — Entraînement : exercices, programmes (modèles + assignés), séances,
--        séries prescrites, séances réalisées, séries réalisées, records.
-- =============================================================================

create type public.muscle_group as enum (
  'chest', 'back', 'lats', 'traps', 'shoulders', 'rear_delts', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'lower_back', 'glutes', 'quads', 'hamstrings', 'adductors', 'abductors',
  'calves', 'full_body', 'cardio'
);
create type public.equipment as enum (
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith',
  'ez_bar', 'cardio_machine', 'other'
);
create type public.exercise_type as enum ('free_weight', 'machine', 'bodyweight', 'cardio', 'timed');
create type public.program_kind as enum ('template', 'assigned');
create type public.program_status as enum ('draft', 'active', 'completed', 'archived');
create type public.set_type as enum ('warmup', 'working', 'drop', 'failure', 'backoff', 'amrap');
create type public.session_status as enum ('in_progress', 'completed', 'abandoned');
create type public.record_type as enum ('max_load', 'estimated_1rm', 'reps_at_load', 'session_volume');

-- -----------------------------------------------------------------------------
-- Bibliothèque d'exercices
-- -----------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  primary_muscle public.muscle_group not null,
  secondary_muscles public.muscle_group[] not null default '{}',
  equipment public.equipment not null,
  type public.exercise_type not null,
  -- Vidéo de démonstration : fichier dans le bucket privé "exercise-media" OU lien externe.
  video_path text,
  video_url text check (video_url is null or video_url ~* '^https://'),
  instructions text,
  -- Incrément de charge proposé par l'algorithme (kg).
  load_increment_kg numeric(5, 2) not null default 2.5 check (load_increment_kg > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index exercises_name_unique on public.exercises (lower(name));

create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

alter table public.exercises enable row level security;

create policy "exercices : lecture par les utilisateurs actifs"
  on public.exercises for select to authenticated using (public.is_active_user());
create policy "exercices : écriture par le coach"
  on public.exercises for insert to authenticated with check (public.is_coach());
create policy "exercices : modification par le coach"
  on public.exercises for update to authenticated using (public.is_coach()) with check (public.is_coach());
create policy "exercices : suppression par le coach"
  on public.exercises for delete to authenticated using (public.is_coach());

-- Alternatives proposées par le coach (machine prise, etc.)
create table public.exercise_alternatives (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  alternative_id uuid not null references public.exercises (id) on delete cascade,
  primary key (exercise_id, alternative_id),
  check (exercise_id <> alternative_id)
);

alter table public.exercise_alternatives enable row level security;

create policy "alternatives : lecture par les utilisateurs actifs"
  on public.exercise_alternatives for select to authenticated using (public.is_active_user());
create policy "alternatives : écriture par le coach"
  on public.exercise_alternatives for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

-- -----------------------------------------------------------------------------
-- Programmes : un « modèle » réutilisable ou un programme « assigné » à un adhérent
-- (copie modifiable d'un modèle).
-- -----------------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  kind public.program_kind not null,
  name text not null check (length(name) between 1 and 120),
  description text,
  adherent_id uuid references public.profiles (id) on delete cascade,
  source_template_id uuid references public.programs (id) on delete set null,
  start_date date,
  duration_weeks smallint not null default 4 check (duration_weeks between 1 and 52),
  status public.program_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un modèle n'a pas d'adhérent ; un programme assigné en a toujours un et une date de début.
  check (
    (kind = 'template' and adherent_id is null)
    or (kind = 'assigned' and adherent_id is not null and start_date is not null)
  )
);

create index programs_adherent on public.programs (adherent_id, status);

create trigger programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();

-- L'adhérent voit ses programmes assignés « en cours » ou « terminés » (pas les brouillons).
create or replace function public.can_read_program(p_program uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_coach() or exists (
    select 1 from public.programs p
    where p.id = p_program
      and p.kind = 'assigned'
      and p.adherent_id = (select auth.uid())
      and p.status in ('active', 'completed')
  ) and public.is_active_user();
$$;
revoke all on function public.can_read_program(uuid) from public;
grant execute on function public.can_read_program(uuid) to authenticated;

alter table public.programs enable row level security;

create policy "programmes : coach"
  on public.programs for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "programmes : lecture par l'adhérent concerné"
  on public.programs for select to authenticated using (public.can_read_program(id));

-- Date calendaire d'une séance : semaine 1 = semaine (lundi→dimanche) contenant la date
-- de début ; jour 1 = lundi … 7 = dimanche.
create or replace function public.workout_date(p_start date, p_week integer, p_day integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_start - (extract(isodow from p_start)::integer - 1) + ((p_week - 1) * 7) + (p_day - 1);
$$;

-- -----------------------------------------------------------------------------
-- Séances d'un programme (ex. « Push A », semaine 2, mercredi)
-- -----------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week_index smallint not null check (week_index between 1 and 52),
  day_of_week smallint not null check (day_of_week between 1 and 7),
  name text not null check (length(name) between 1 and 80),
  position smallint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workouts_program on public.workouts (program_id, week_index, day_of_week, position);

create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();

alter table public.workouts enable row level security;

create policy "séances : coach"
  on public.workouts for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "séances : lecture adhérent"
  on public.workouts for select to authenticated using (public.can_read_program(program_id));

-- -----------------------------------------------------------------------------
-- Exercices d'une séance
-- -----------------------------------------------------------------------------
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  -- Copie dénormalisée (remplie automatiquement) pour des règles de sécurité simples.
  program_id uuid not null references public.programs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null default 0,
  -- Même lettre = exercices enchaînés en superset (ex. 'A').
  superset_group text check (superset_group is null or superset_group ~ '^[A-Z]$'),
  coach_notes text,
  -- Alternatives propres à ce programme (sinon : celles de la bibliothèque).
  alternative_exercise_ids uuid[] not null default '{}',
  -- Objectif affiché à l'adhérent pour la prochaine séance (ex. « vise 11 reps »).
  next_session_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_exercises_workout on public.workout_exercises (workout_id, position);
create index workout_exercises_program on public.workout_exercises (program_id, exercise_id);

create or replace function public.fill_workout_exercise_program()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select program_id into new.program_id from public.workouts where id = new.workout_id;
  return new;
end;
$$;

create trigger workout_exercises_fill before insert or update of workout_id on public.workout_exercises
  for each row execute function public.fill_workout_exercise_program();
create trigger workout_exercises_updated_at before update on public.workout_exercises
  for each row execute function public.set_updated_at();

alter table public.workout_exercises enable row level security;

create policy "exercices de séance : coach"
  on public.workout_exercises for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "exercices de séance : lecture adhérent"
  on public.workout_exercises for select to authenticated using (public.can_read_program(program_id));

-- -----------------------------------------------------------------------------
-- Séries prescrites
-- -----------------------------------------------------------------------------
create table public.prescribed_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  position smallint not null default 0,
  set_type public.set_type not null default 'working',
  -- Répétitions cibles : fixe (min = max) ou fourchette (ex. 8–12).
  reps_min smallint check (reps_min is null or reps_min between 0 and 200),
  reps_max smallint check (reps_max is null or reps_max between 0 and 200),
  -- Charge cible : en kg OU en % du 1RM de référence (fourni par le coach).
  load_kg numeric(6, 2) check (load_kg is null or load_kg >= 0),
  load_pct_1rm numeric(5, 2) check (load_pct_1rm is null or load_pct_1rm between 1 and 120),
  target_rir numeric(3, 1) check (target_rir is null or target_rir between 0 and 10),
  target_rpe numeric(3, 1) check (target_rpe is null or target_rpe between 1 and 10),
  rest_seconds smallint check (rest_seconds is null or rest_seconds between 0 and 1800),
  tempo text check (tempo is null or tempo ~ '^[0-9X]{4}$'),
  -- Pour les exercices au temps (gainage, cardio…).
  duration_seconds smallint check (duration_seconds is null or duration_seconds between 1 and 7200),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reps_min is null or reps_max is null or reps_min <= reps_max)
);

create index prescribed_sets_we on public.prescribed_sets (workout_exercise_id, position);

create or replace function public.fill_prescribed_set_program()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select program_id into new.program_id from public.workout_exercises where id = new.workout_exercise_id;
  return new;
end;
$$;

create trigger prescribed_sets_fill before insert or update of workout_exercise_id on public.prescribed_sets
  for each row execute function public.fill_prescribed_set_program();
create trigger prescribed_sets_updated_at before update on public.prescribed_sets
  for each row execute function public.set_updated_at();

alter table public.prescribed_sets enable row level security;

create policy "séries prescrites : coach"
  on public.prescribed_sets for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "séries prescrites : lecture adhérent"
  on public.prescribed_sets for select to authenticated using (public.can_read_program(program_id));

-- -----------------------------------------------------------------------------
-- Ajustements d'une semaine (ex. semaine de décharge : volume × 0,5)
-- -----------------------------------------------------------------------------
create table public.program_week_adjustments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  week_index smallint not null check (week_index between 1 and 52),
  -- Multiplicateur du nombre de séries de travail (0,5 = moitié).
  volume_factor numeric(3, 2) not null default 1 check (volume_factor between 0.1 and 1.5),
  -- Multiplicateur des charges (1 = inchangé).
  load_factor numeric(3, 2) not null default 1 check (load_factor between 0.5 and 1.2),
  note text,
  created_at timestamptz not null default now(),
  unique (program_id, week_index)
);

alter table public.program_week_adjustments enable row level security;

create policy "ajustements : coach"
  on public.program_week_adjustments for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "ajustements : lecture adhérent"
  on public.program_week_adjustments for select to authenticated
  using (public.can_read_program(program_id));

-- -----------------------------------------------------------------------------
-- 1RM de référence (fourni par le coach), utilisé pour les charges en % du 1RM
-- -----------------------------------------------------------------------------
create table public.reference_1rm (
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  value_kg numeric(6, 2) not null check (value_kg > 0),
  measured_on date not null default current_date,
  updated_at timestamptz not null default now(),
  primary key (adherent_id, exercise_id)
);

create trigger reference_1rm_updated_at before update on public.reference_1rm
  for each row execute function public.set_updated_at();

alter table public.reference_1rm enable row level security;

create policy "1RM : coach"
  on public.reference_1rm for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "1RM : lecture adhérent"
  on public.reference_1rm for select to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user());

-- -----------------------------------------------------------------------------
-- Séances réalisées (identifiant généré par l'appareil → pas de doublon à la synchro)
-- -----------------------------------------------------------------------------
create table public.session_logs (
  id uuid primary key,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid references public.programs (id) on delete set null,
  workout_id uuid references public.workouts (id) on delete set null,
  -- Date prévue de la séance (pour l'assiduité), éventuellement différente du jour réel.
  scheduled_date date,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  status public.session_status not null default 'in_progress',
  -- Ressenti global 1–10.
  rating smallint check (rating is null or rating between 1 and 10),
  notes text,
  -- Rempli par le serveur quand l'algorithme de suggestions a analysé la séance.
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_logs_adherent on public.session_logs (adherent_id, started_at desc);
create index session_logs_to_analyze on public.session_logs (status) where analyzed_at is null;

create trigger session_logs_updated_at before update on public.session_logs
  for each row execute function public.set_updated_at();

-- Un adhérent ne peut pas toucher au champ technique analyzed_at.
create or replace function public.protect_session_logs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_coach() then
    if tg_op = 'INSERT' then
      new.analyzed_at := null;
    else
      new.analyzed_at := old.analyzed_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger session_logs_protect before insert or update on public.session_logs
  for each row execute function public.protect_session_logs();

alter table public.session_logs enable row level security;

create policy "séances réalisées : lecture"
  on public.session_logs for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "séances réalisées : création par l'adhérent"
  on public.session_logs for insert to authenticated
  with check (adherent_id = (select auth.uid()) and public.is_active_user());
create policy "séances réalisées : modification par l'adhérent"
  on public.session_logs for update to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user())
  with check (adherent_id = (select auth.uid()));

create or replace function public.owns_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.session_logs
    where id = p_session and adherent_id = (select auth.uid())
  );
$$;
revoke all on function public.owns_session(uuid) from public;
grant execute on function public.owns_session(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Séries réalisées
-- -----------------------------------------------------------------------------
create table public.set_logs (
  id uuid primary key,
  session_log_id uuid not null references public.session_logs (id) on delete cascade,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  -- Exercice réellement fait (peut différer du prévu en cas de remplacement).
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  workout_exercise_id uuid references public.workout_exercises (id) on delete set null,
  prescribed_set_id uuid references public.prescribed_sets (id) on delete set null,
  position smallint not null default 0,
  set_type public.set_type not null default 'working',
  load_kg numeric(6, 2) check (load_kg is null or load_kg >= 0),
  reps smallint check (reps is null or reps between 0 and 500),
  rir numeric(3, 1) check (rir is null or rir between 0 and 10),
  rpe numeric(3, 1) check (rpe is null or rpe between 1 and 10),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  -- Repos réel mesuré par le minuteur, et repos prescrit au moment de la séance.
  rest_seconds_actual integer check (rest_seconds_actual is null or rest_seconds_actual >= 0),
  rest_seconds_prescribed integer,
  -- Série validée (true) ou ratée (false).
  completed boolean not null default true,
  note text,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index set_logs_session on public.set_logs (session_log_id, position);
create index set_logs_adherent_exercise on public.set_logs (adherent_id, exercise_id, performed_at desc);

create trigger set_logs_updated_at before update on public.set_logs
  for each row execute function public.set_updated_at();

alter table public.set_logs enable row level security;

create policy "séries réalisées : lecture"
  on public.set_logs for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "séries réalisées : création par l'adhérent"
  on public.set_logs for insert to authenticated
  with check (
    adherent_id = (select auth.uid()) and public.is_active_user() and public.owns_session(session_log_id)
  );
create policy "séries réalisées : modification par l'adhérent"
  on public.set_logs for update to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user())
  with check (adherent_id = (select auth.uid()) and public.owns_session(session_log_id));
create policy "séries réalisées : suppression par l'adhérent"
  on public.set_logs for delete to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user());

-- -----------------------------------------------------------------------------
-- Records personnels (détectés par l'app, y compris hors-ligne)
-- -----------------------------------------------------------------------------
create table public.personal_records (
  id uuid primary key,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  record_type public.record_type not null,
  -- Valeur du record (kg, ou nombre de reps pour reps_at_load, ou kg·reps pour le volume).
  value numeric(10, 2) not null,
  -- Pour reps_at_load : charge à laquelle le nombre de reps a été battu.
  load_kg numeric(6, 2),
  achieved_at timestamptz not null,
  set_log_id uuid references public.set_logs (id) on delete set null,
  session_log_id uuid references public.session_logs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index personal_records_adherent on public.personal_records (adherent_id, exercise_id, record_type, achieved_at desc);

alter table public.personal_records enable row level security;

create policy "records : lecture"
  on public.personal_records for select to authenticated using (public.can_access_adherent(adherent_id));
create policy "records : création par l'adhérent"
  on public.personal_records for insert to authenticated
  with check (
    adherent_id = (select auth.uid()) and public.is_active_user()
    and (session_log_id is null or public.owns_session(session_log_id))
  );
-- Nécessaire pour les « upsert » idempotents de la synchronisation.
create policy "records : mise à jour par l'adhérent"
  on public.personal_records for update to authenticated
  using (adherent_id = (select auth.uid()) and public.is_active_user())
  with check (adherent_id = (select auth.uid()));
