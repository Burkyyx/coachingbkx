-- =============================================================================
-- PHASE 3 — Communauté, XP, badges, challenges.
--
-- Règle absolue : AUCUNE donnée de poids, de mensurations ou de nutrition n'est
-- exposée par la communauté. Les fonctions « publiques » ci-dessous ne renvoient
-- que des pseudos, des XP, des niveaux, des badges et des progressions de
-- challenge calculées à partir des SÉANCES (effort et régularité).
-- Les XP du journal alimentaire récompensent seulement le fait de noter ses repas
-- (≥ 2 repas dans la journée), jamais un chiffre.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Réglages du coach : barème d'XP (modifiable, plafonné)
-- -----------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists xp_rules jsonb not null default jsonb_build_object(
    'session', 20, 'checkin', 15, 'full_week', 30, 'record', 10, 'record_max_per_session', 3,
    'challenge', 50, 'journal_day', 10, 'daily_cap', 100
  );

-- Fenêtre « Rejoindre la communauté ? » déjà proposée aux adhérents inscrits avant la Phase 3.
alter table public.profiles add column if not exists community_prompted_at timestamptz;

-- -----------------------------------------------------------------------------
-- Membres de la communauté (consentement « community » requis)
-- -----------------------------------------------------------------------------
create table public.community_members (
  adherent_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  -- Posts automatiques (record, séance terminée, badge, challenge réussi) : désactivés par défaut.
  auto_posts boolean not null default false,
  suspended_at timestamptz,
  joined_at timestamptz not null default now()
);

create or replace function public.has_community_consent(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = p_user and c.type = 'community' and c.revoked_at is null
  );
$$;

-- Membre actif : compte actif, consentement en cours, pas suspendu.
create or replace function public.is_community_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_members m
    where m.adherent_id = (select auth.uid()) and m.suspended_at is null
  )
  and public.is_active_user()
  and public.has_community_consent((select auth.uid()));
$$;

-- Le membre peut changer son pseudo et ses posts automatiques ; seul le coach suspend.
create or replace function public.protect_community_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_coach() then
    return new;
  end if;
  if new.adherent_id is distinct from old.adherent_id
     or new.suspended_at is distinct from old.suspended_at
     or new.joined_at is distinct from old.joined_at then
    raise exception 'Modification non autorisée' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger community_members_protect before update on public.community_members
  for each row execute function public.protect_community_member();

alter table public.community_members enable row level security;
create policy "membres : lecture par les membres et le coach"
  on public.community_members for select to authenticated
  using (public.is_coach() or public.is_community_member() or adherent_id = (select auth.uid()));
create policy "membres : adhésion par soi-même (consentement requis)"
  on public.community_members for insert to authenticated
  with check (
    adherent_id = (select auth.uid()) and public.is_active_user()
    and public.has_community_consent((select auth.uid())) and suspended_at is null
  );
create policy "membres : réglages par soi-même ou le coach"
  on public.community_members for update to authenticated
  using (adherent_id = (select auth.uid()) or public.is_coach())
  with check (adherent_id = (select auth.uid()) or public.is_coach());
create policy "membres : départ (soi-même) ou retrait par le coach"
  on public.community_members for delete to authenticated
  using (adherent_id = (select auth.uid()) or public.is_coach());

-- -----------------------------------------------------------------------------
-- Filtre de mots interdits (géré par le coach)
-- -----------------------------------------------------------------------------
create table public.community_banned_words (
  word text primary key check (char_length(word) between 2 and 40 and word = lower(word))
);
alter table public.community_banned_words enable row level security;
create policy "mots interdits : coach"
  on public.community_banned_words for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
insert into public.community_banned_words (word) values
  ('connard'), ('connasse'), ('salope'), ('pute'), ('enculé'), ('encule'), ('fdp'), ('ntm'),
  ('pd'), ('batard'), ('bâtard'), ('nique ta mère'), ('fils de pute')
on conflict do nothing;

create or replace function public.check_banned_words(p_text text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  w text;
begin
  if p_text is null then
    return;
  end if;
  for w in select word from public.community_banned_words loop
    -- Mot entier (pas de faux positifs du type « pute » dans « député »).
    if lower(p_text) ~ ('(^|[^a-z0-9à-öø-ÿœæ])' || regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '($|[^a-z0-9à-öø-ÿœæ])') then
      raise exception 'Message refusé : il contient un mot interdit.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Posts, commentaires, réactions, signalements
-- -----------------------------------------------------------------------------
create type public.post_kind as enum ('manual', 'record', 'session', 'badge', 'challenge');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.post_kind not null default 'manual',
  body text check (body is null or char_length(body) <= 2000),
  photo_path text,
  -- Posts automatiques : détails affichés (nom d'exercice, badge…), jamais de poids ni de nutrition.
  payload jsonb not null default '{}'::jsonb,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'manual' or (coalesce(char_length(btrim(body)), 0) > 0 or photo_path is not null))
);
create index posts_feed on public.posts (created_at desc);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index post_comments_post on public.post_comments (post_id, created_at);

create table public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('💪', '🔥', '👏', '❤️')),
  created_at timestamptz not null default now(),
  primary key (post_id, author_id, emoji)
);

create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.post_comments (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);

-- Contenus : mots interdits refusés, champs de modération réservés au coach.
create or replace function public.check_community_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.check_banned_words(new.body);
  if tg_op = 'UPDATE' and (select auth.uid()) is not null and not public.is_coach() then
    if new.hidden_at is distinct from old.hidden_at or new.author_id is distinct from old.author_id then
      raise exception 'Modification non autorisée' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger posts_content before insert or update on public.posts
  for each row execute function public.check_community_content();
create trigger post_comments_content before insert or update on public.post_comments
  for each row execute function public.check_community_content();

alter table public.posts enable row level security;
create policy "posts : lecture par les membres et le coach"
  on public.posts for select to authenticated
  using (
    public.is_coach()
    or (public.is_community_member() and (hidden_at is null or author_id = (select auth.uid())))
  );
create policy "posts : publication par un membre ou le coach"
  on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid()) and kind = 'manual'
    and (public.is_community_member() or public.is_coach())
  );
create policy "posts : modification par l'auteur ou le coach"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()) or public.is_coach())
  with check (author_id = (select auth.uid()) or public.is_coach());
create policy "posts : suppression par l'auteur ou le coach"
  on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_coach());

alter table public.post_comments enable row level security;
create policy "commentaires : lecture par les membres et le coach"
  on public.post_comments for select to authenticated
  using (
    public.is_coach()
    or (
      public.is_community_member()
      and (hidden_at is null or author_id = (select auth.uid()))
      and exists (select 1 from public.posts p where p.id = post_id)
    )
  );
create policy "commentaires : écriture par un membre ou le coach"
  on public.post_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (public.is_community_member() or public.is_coach())
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "commentaires : modification par l'auteur ou le coach"
  on public.post_comments for update to authenticated
  using (author_id = (select auth.uid()) or public.is_coach())
  with check (author_id = (select auth.uid()) or public.is_coach());
create policy "commentaires : suppression par l'auteur ou le coach"
  on public.post_comments for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_coach());

alter table public.post_reactions enable row level security;
create policy "réactions : lecture par les membres et le coach"
  on public.post_reactions for select to authenticated
  using (public.is_coach() or public.is_community_member());
create policy "réactions : ajout par un membre ou le coach"
  on public.post_reactions for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (public.is_community_member() or public.is_coach())
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "réactions : retrait par son auteur"
  on public.post_reactions for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_coach());

alter table public.community_reports enable row level security;
create policy "signalements : lecture par le coach (ou son auteur)"
  on public.community_reports for select to authenticated
  using (public.is_coach() or reporter_id = (select auth.uid()));
create policy "signalements : envoi par un membre"
  on public.community_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_community_member() and resolved_at is null);
create policy "signalements : traitement par le coach"
  on public.community_reports for update to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy "signalements : suppression par le coach"
  on public.community_reports for delete to authenticated
  using (public.is_coach());

-- Photos des posts : bucket privé  community-media/<auteur>/<post>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('community-media', 'community-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "photos communauté : lecture par les membres et le coach"
  on storage.objects for select to authenticated
  using (bucket_id = 'community-media' and (public.is_community_member() or public.is_coach()));
create policy "photos communauté : envoi dans son dossier"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (public.is_community_member() or public.is_coach())
  );
create policy "photos communauté : suppression (auteur ou coach)"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-media'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_coach())
  );

-- -----------------------------------------------------------------------------
-- XP et badges (écrits uniquement par le serveur)
-- -----------------------------------------------------------------------------
create type public.xp_kind as enum ('session', 'checkin', 'full_week', 'record', 'challenge', 'journal_day');

create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  kind public.xp_kind not null,
  -- 0 possible (plafond du jour atteint) : l'événement compte quand même (séries, badges).
  points integer not null check (points >= 0),
  -- Évite d'attribuer deux fois les XP d'un même événement (ex. « session:<id> »).
  source text not null,
  -- Regroupement (ex. séance d'un record, pour le plafond de records par séance).
  context text,
  occurred_on date not null,
  created_at timestamptz not null default now(),
  unique (adherent_id, kind, source)
);
create index xp_events_adherent on public.xp_events (adherent_id, occurred_on);

create table public.badges_earned (
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  primary key (adherent_id, badge_key)
);

alter table public.xp_events enable row level security;
create policy "XP : lecture par soi-même ou le coach"
  on public.xp_events for select to authenticated using (public.can_access_adherent(adherent_id));
alter table public.badges_earned enable row level security;
create policy "badges : lecture par soi-même ou le coach"
  on public.badges_earned for select to authenticated using (public.can_access_adherent(adherent_id));
-- Aucune politique d'écriture : uniquement les fonctions serveur ci-dessous.

-- Date du jour à Paris d'un horodatage.
create or replace function public.paris_date(p_ts timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$ select (p_ts at time zone 'Europe/Paris')::date $$;

-- Post automatique (si le membre les a activés).
create or replace function public.create_auto_post(p_adherent uuid, p_kind public.post_kind, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.community_members m
    where m.adherent_id = p_adherent and m.auto_posts and m.suspended_at is null
  ) and public.has_community_consent(p_adherent) then
    insert into public.posts (author_id, kind, payload) values (p_adherent, p_kind, p_payload);
  end if;
end;
$$;

-- Attribue des XP selon le barème du coach, dans la limite du plafond quotidien.
create or replace function public.award_xp(
  p_adherent uuid, p_kind public.xp_kind, p_source text, p_on date, p_context text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules jsonb;
  v_rule integer;
  v_cap integer;
  v_used integer;
  v_points integer;
begin
  select xp_rules into v_rules from public.app_settings where id = 1;
  v_rule := least(greatest(coalesce((v_rules ->> p_kind::text)::integer, 0), 0), 500);
  v_cap := least(greatest(coalesce((v_rules ->> 'daily_cap')::integer, 100), 0), 2000);
  select coalesce(sum(points), 0) into v_used
  from public.xp_events where adherent_id = p_adherent and occurred_on = p_on;
  v_points := least(v_rule, greatest(v_cap - v_used, 0));
  insert into public.xp_events (adherent_id, kind, points, source, context, occurred_on)
  values (p_adherent, p_kind, v_points, p_source, p_context, p_on)
  on conflict (adherent_id, kind, source) do nothing;
  return v_points;
end;
$$;

-- Badge (une seule fois) + post automatique.
create or replace function public.award_badge(p_adherent uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.badges_earned (adherent_id, badge_key) values (p_adherent, p_key)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    perform public.create_auto_post(p_adherent, 'badge', jsonb_build_object('badge', p_key));
  end if;
end;
$$;

-- Plus longue série de semaines complètes consécutives (sur une période éventuelle).
create or replace function public.full_week_streak(p_adherent uuid, p_from date default null, p_to date default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with weeks as (
    select distinct date_trunc('week', occurred_on)::date as w
    from public.xp_events
    where adherent_id = p_adherent and kind = 'full_week'
      and (p_from is null or occurred_on >= p_from) and (p_to is null or occurred_on <= p_to)
  ), grouped as (
    select w, w - (row_number() over (order by w))::integer * 7 as grp from weeks
  )
  select coalesce(max(n), 0)::integer from (select count(*) as n from grouped group by grp) s;
$$;

-- Badges liés aux séances et aux records.
create or replace function public.check_training_badges(p_adherent uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessions integer;
begin
  select count(*) into v_sessions from public.session_logs
  where adherent_id = p_adherent and status = 'completed';
  if v_sessions >= 1 then perform public.award_badge(p_adherent, 'first_session'); end if;
  if v_sessions >= 10 then perform public.award_badge(p_adherent, 'sessions_10'); end if;
  if v_sessions >= 50 then perform public.award_badge(p_adherent, 'sessions_50'); end if;
  if v_sessions >= 100 then perform public.award_badge(p_adherent, 'sessions_100'); end if;
  if public.full_week_streak(p_adherent) >= 4 then
    perform public.award_badge(p_adherent, 'streak_4_weeks');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Challenges (créés par le coach, uniquement effort et régularité)
-- -----------------------------------------------------------------------------
create type public.challenge_metric as enum ('sessions', 'streak_weeks', 'volume', 'reps');

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  description text check (description is null or char_length(description) <= 2000),
  metric public.challenge_metric not null,
  -- Facultatif pour « volume » et « reps » (ex. 500 pompes) ; sinon tous les exercices.
  exercise_id uuid references public.exercises (id) on delete set null,
  target numeric(12, 1) not null check (target > 0),
  -- Collectif : objectif commun (somme des participants).
  collective boolean not null default false,
  starts_on date not null,
  ends_on date not null,
  leaderboard boolean not null default false,
  xp_reward integer not null default 50 check (xp_reward between 0 and 500),
  -- Récompense réelle facultative (ex. « séance offerte »).
  real_reward text check (real_reward is null or char_length(real_reward) <= 200),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (not collective or metric <> 'streak_weeks')
);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  adherent_id uuid not null references public.profiles (id) on delete cascade,
  progress numeric(14, 1) not null default 0,
  completed_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, adherent_id)
);

alter table public.challenges enable row level security;
create policy "challenges : lecture par les membres et le coach"
  on public.challenges for select to authenticated
  using (public.is_coach() or public.is_community_member());
create policy "challenges : gestion par le coach"
  on public.challenges for all to authenticated
  using (public.is_coach()) with check (public.is_coach());

alter table public.challenge_participants enable row level security;
create policy "participants : lecture par soi-même ou le coach"
  on public.challenge_participants for select to authenticated
  using (adherent_id = (select auth.uid()) or public.is_coach());
create policy "participants : inscription par un membre"
  on public.challenge_participants for insert to authenticated
  with check (
    adherent_id = (select auth.uid()) and public.is_community_member()
    and progress = 0 and completed_at is null
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and c.ends_on >= public.paris_date(now())
    )
  );
create policy "participants : départ (soi-même) ou retrait par le coach"
  on public.challenge_participants for delete to authenticated
  using (adherent_id = (select auth.uid()) or public.is_coach());
-- Pas de mise à jour directe : la progression est calculée par le serveur.

-- Valeur d'une métrique pour un adhérent sur une période (séances terminées uniquement).
create or replace function public.challenge_metric_value(
  p_adherent uuid, p_metric public.challenge_metric, p_exercise uuid, p_from date, p_to date
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v numeric := 0;
begin
  if p_metric = 'sessions' then
    select count(*) into v from public.session_logs s
    where s.adherent_id = p_adherent and s.status = 'completed'
      and public.paris_date(s.started_at) between p_from and p_to;
  elsif p_metric = 'streak_weeks' then
    v := public.full_week_streak(p_adherent, p_from, p_to);
  elsif p_metric in ('volume', 'reps') then
    select coalesce(sum(case when p_metric = 'volume' then coalesce(l.load_kg, 0) * coalesce(l.reps, 0)
                             else coalesce(l.reps, 0) end), 0)
      into v
    from public.set_logs l
    join public.session_logs s on s.id = l.session_log_id
    where s.adherent_id = p_adherent and s.status = 'completed'
      and public.paris_date(s.started_at) between p_from and p_to
      and l.completed and l.set_type <> 'warmup'
      and (p_exercise is null or l.exercise_id = p_exercise);
  end if;
  return round(coalesce(v, 0), 1);
end;
$$;

-- Réussite d'un challenge : XP, badge, post automatique.
create or replace function public.complete_challenge(p_challenge public.challenges, p_adherent uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules jsonb;
begin
  update public.challenge_participants set completed_at = now()
  where challenge_id = p_challenge.id and adherent_id = p_adherent and completed_at is null;
  if not found then
    return;
  end if;
  if p_challenge.xp_reward > 0 then
    -- Les XP du challenge suivent sa propre récompense (dans la limite du plafond quotidien).
    select xp_rules into v_rules from public.app_settings where id = 1;
    insert into public.xp_events (adherent_id, kind, points, source, occurred_on)
    select p_adherent, 'challenge', p.pts, 'challenge:' || p_challenge.id, public.paris_date(now())
    from (
      select least(
        p_challenge.xp_reward,
        greatest(
          least(greatest(coalesce((v_rules ->> 'daily_cap')::integer, 100), 0), 2000)
          - coalesce((select sum(points) from public.xp_events
                      where adherent_id = p_adherent and occurred_on = public.paris_date(now())), 0),
          0
        )
      ) as pts
    ) p
    on conflict (adherent_id, kind, source) do nothing;
  end if;
  perform public.award_badge(p_adherent, 'challenge_won');
  perform public.create_auto_post(
    p_adherent, 'challenge', jsonb_build_object('challenge_id', p_challenge.id, 'title', p_challenge.title)
  );
end;
$$;

-- Recalcule la progression des challenges en cours d'un adhérent.
create or replace function public.refresh_challenge_progress(p_adherent uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v numeric;
  v_total numeric;
  r record;
begin
  for c in
    select ch.* from public.challenges ch
    join public.challenge_participants cp on cp.challenge_id = ch.id and cp.adherent_id = p_adherent
    where ch.starts_on <= public.paris_date(now())
  loop
    v := public.challenge_metric_value(p_adherent, c.metric, c.exercise_id, c.starts_on, c.ends_on);
    update public.challenge_participants set progress = v
    where challenge_id = c.id and adherent_id = p_adherent;
    if c.collective then
      select coalesce(sum(progress), 0) into v_total from public.challenge_participants where challenge_id = c.id;
      if v_total >= c.target then
        for r in select adherent_id from public.challenge_participants
                 where challenge_id = c.id and completed_at is null loop
          perform public.complete_challenge(c, r.adherent_id);
        end loop;
      end if;
    elsif v >= c.target then
      perform public.complete_challenge(c, p_adherent);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Déclencheurs : XP, badges, posts automatiques, challenges
-- -----------------------------------------------------------------------------

-- Séance terminée (ou supprimée).
create or replace function public.on_session_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date;
  v_program uuid;
  v_week smallint;
  v_planned integer;
  v_done integer;
  v_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.xp_events
    where adherent_id = old.adherent_id and (source = 'session:' || old.id or context = old.id::text);
    perform public.refresh_challenge_progress(old.adherent_id);
    return old;
  end if;
  if new.status <> 'completed' or (tg_op = 'UPDATE' and old.status = 'completed') then
    return new;
  end if;
  v_day := public.paris_date(new.started_at);
  perform public.award_xp(new.adherent_id, 'session', 'session:' || new.id, v_day);

  -- Semaine complète : toutes les séances prévues de la semaine du programme sont faites.
  select w.program_id, w.week_index, w.name into v_program, v_week, v_name
  from public.workouts w where w.id = new.workout_id;
  if v_program is not null then
    select count(*) into v_planned from public.workouts
    where program_id = v_program and week_index = v_week;
    select count(distinct s.workout_id) into v_done
    from public.session_logs s join public.workouts w on w.id = s.workout_id
    where s.adherent_id = new.adherent_id and s.status = 'completed'
      and w.program_id = v_program and w.week_index = v_week;
    if v_planned > 0 and v_done >= v_planned then
      perform public.award_xp(new.adherent_id, 'full_week', 'week:' || v_program || ':' || v_week, v_day);
    end if;
  end if;

  perform public.check_training_badges(new.adherent_id);
  perform public.create_auto_post(
    new.adherent_id, 'session', jsonb_build_object('workout_name', v_name, 'duration_seconds', new.duration_seconds)
  );
  perform public.refresh_challenge_progress(new.adherent_id);
  return new;
end;
$$;
create trigger session_logs_progress
  after insert or update of status or delete on public.session_logs
  for each row execute function public.on_session_progress();

-- Record battu (au plus N records récompensés par séance).
create or replace function public.on_record_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_count integer;
  v_exercise text;
begin
  select coalesce((xp_rules ->> 'record_max_per_session')::integer, 3) into v_max
  from public.app_settings where id = 1;
  select count(*) into v_count from public.xp_events
  where adherent_id = new.adherent_id and kind = 'record'
    and context = coalesce(new.session_log_id::text, public.paris_date(new.achieved_at)::text);
  if v_count < v_max then
    perform public.award_xp(
      new.adherent_id, 'record', 'record:' || new.id, public.paris_date(new.achieved_at),
      coalesce(new.session_log_id::text, public.paris_date(new.achieved_at)::text)
    );
  end if;
  perform public.award_badge(new.adherent_id, 'first_record');
  select name into v_exercise from public.exercises where id = new.exercise_id;
  -- Un seul post par exercice et par séance (plusieurs types de record peuvent tomber ensemble).
  if not exists (
    select 1 from public.posts p
    where p.author_id = new.adherent_id and p.kind = 'record'
      and p.payload ->> 'exercise_id' = new.exercise_id::text
      and p.payload ->> 'session_id' is not distinct from new.session_log_id::text
  ) then
    perform public.create_auto_post(new.adherent_id, 'record', jsonb_build_object(
      'exercise_id', new.exercise_id, 'exercise_name', v_exercise, 'record_type', new.record_type,
      'value', new.value, 'load_kg', new.load_kg, 'session_id', new.session_log_id
    ));
  end if;
  return new;
end;
$$;
create trigger personal_records_progress after insert on public.personal_records
  for each row execute function public.on_record_progress();

-- Bilan hebdomadaire rempli.
create or replace function public.on_checkin_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_xp(new.adherent_id, 'checkin', 'checkin:' || new.id, public.paris_date(new.submitted_at));
  return new;
end;
$$;
create trigger checkins_progress after insert on public.checkins
  for each row execute function public.on_checkin_progress();

-- Journal alimentaire tenu : au moins 2 repas notés dans la journée (aucun chiffre pris en compte).
create or replace function public.on_meal_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := public.paris_date(new.eaten_at);
begin
  if (select count(*) from public.meals
      where adherent_id = new.adherent_id and public.paris_date(eaten_at) = v_day) >= 2 then
    perform public.award_xp(new.adherent_id, 'journal_day', 'journal:' || v_day, v_day);
  end if;
  return new;
end;
$$;
create trigger meals_progress after insert on public.meals
  for each row execute function public.on_meal_progress();

-- Inscription à un challenge : progression calculée tout de suite.
create or replace function public.on_challenge_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_challenge_progress(new.adherent_id);
  return new;
end;
$$;
create trigger challenge_participants_join after insert on public.challenge_participants
  for each row execute function public.on_challenge_join();

-- (Phase 1, rendue robuste) Alerte « record battu » : le message ne peut plus être vide
-- (charge manquante) — un record ne doit jamais bloquer la synchronisation d'une séance.
create or replace function public.on_personal_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ex text;
  v_msg text;
begin
  if new.record_type = 'session_volume' then
    return new;
  end if;
  select name into v_ex from public.exercises where id = new.exercise_id;
  v_msg := coalesce(public.display_name(new.adherent_id), 'Un adhérent') || ' : nouveau record sur '
    || coalesce(v_ex, 'un exercice')
    || coalesce(case new.record_type
         when 'max_load' then ' (' || trim(to_char(new.value, 'FM999990.##')) || ' kg)'
         when 'estimated_1rm' then ' (1RM estimé ' || trim(to_char(new.value, 'FM999990.#')) || ' kg)'
         else ' (' || trim(to_char(new.value, 'FM999990')) || ' reps'
              || coalesce(' à ' || trim(to_char(new.load_kg, 'FM999990.##')) || ' kg', '') || ')'
       end, '');
  insert into public.alerts (adherent_id, type, message, payload, dedupe_key)
  values (new.adherent_id, 'new_record', v_msg,
          jsonb_build_object('record_id', new.id, 'exercise_id', new.exercise_id),
          'record:' || new.id)
  on conflict (dedupe_key) do nothing;
  perform public.notify(public.coach_id(), 'new_record', 'Record battu 🏆', v_msg,
                        jsonb_build_object('adherent_id', new.adherent_id));
  return new;
end;
$$;

-- Fonctions internes : jamais appelables directement depuis l'app.
revoke all on function public.award_xp(uuid, public.xp_kind, text, date, text) from public, anon, authenticated;
revoke all on function public.award_badge(uuid, text) from public, anon, authenticated;
revoke all on function public.create_auto_post(uuid, public.post_kind, jsonb) from public, anon, authenticated;
revoke all on function public.check_training_badges(uuid) from public, anon, authenticated;
revoke all on function public.complete_challenge(public.challenges, uuid) from public, anon, authenticated;
revoke all on function public.refresh_challenge_progress(uuid) from public, anon, authenticated;
revoke all on function public.challenge_metric_value(uuid, public.challenge_metric, uuid, date, date) from public, anon, authenticated;
revoke all on function public.full_week_streak(uuid, date, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Lecture « publique » de la communauté (pseudos, XP, badges — rien d'autre)
-- -----------------------------------------------------------------------------
create or replace function public.community_people()
returns table (id uuid, display_name text, is_coach boolean, xp integer, badges integer, is_me boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_community_member() or public.is_coach()) then
    return;
  end if;
  return query
  select m.adherent_id, m.display_name, false,
         coalesce((select sum(x.points)::integer from public.xp_events x where x.adherent_id = m.adherent_id), 0),
         (select count(*)::integer from public.badges_earned b where b.adherent_id = m.adherent_id),
         m.adherent_id = (select auth.uid())
  from public.community_members m
  where m.suspended_at is null and public.has_community_consent(m.adherent_id)
  union all
  select p.id, 'Coach ' || coalesce(p.first_name, ''), true, 0, 0, p.id = (select auth.uid())
  from public.profiles p where p.role = 'coach';
end;
$$;
revoke all on function public.community_people() from public, anon;
grant execute on function public.community_people() to authenticated;

-- Classement / progression d'un challenge (tous les participants si classement activé,
-- sinon seulement soi-même ; le total collectif est toujours donné).
create or replace function public.challenge_board(p_challenge uuid)
returns table (adherent_id uuid, display_name text, progress numeric, completed boolean, is_me boolean, total numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_total numeric;
begin
  if not (public.is_community_member() or public.is_coach()) then
    return;
  end if;
  select * into c from public.challenges where id = p_challenge;
  if not found then
    return;
  end if;
  select coalesce(sum(cp.progress), 0) into v_total from public.challenge_participants cp where cp.challenge_id = c.id;
  return query
  select cp.adherent_id, m.display_name, cp.progress, cp.completed_at is not null,
         cp.adherent_id = (select auth.uid()), v_total
  from public.challenge_participants cp
  join public.community_members m on m.adherent_id = cp.adherent_id
  where cp.challenge_id = c.id
    and (c.leaderboard or public.is_coach() or cp.adherent_id = (select auth.uid()))
  order by cp.progress desc, cp.joined_at;
end;
$$;
revoke all on function public.challenge_board(uuid) from public, anon;
grant execute on function public.challenge_board(uuid) to authenticated;

-- Nombre de participants par challenge (sans les noms).
create or replace function public.challenge_counts()
returns table (challenge_id uuid, participants integer, total numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.challenge_id, count(*)::integer, coalesce(sum(cp.progress), 0)
  from public.challenge_participants cp
  where public.is_community_member() or public.is_coach()
  group by cp.challenge_id;
$$;
revoke all on function public.challenge_counts() from public, anon;
grant execute on function public.challenge_counts() to authenticated;

-- -----------------------------------------------------------------------------
-- Export RGPD : ajout des données de la communauté
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
    'ai_usage', coalesce((select jsonb_agg(to_jsonb(u) - 'cost_usd' order by u.created_at) from public.ai_usage u where u.adherent_id = v_uid), '[]'),
    'community_member', (select to_jsonb(m) from public.community_members m where m.adherent_id = v_uid),
    'posts', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.posts p where p.author_id = v_uid), '[]'),
    'post_comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.post_comments c where c.author_id = v_uid), '[]'),
    'post_reactions', coalesce((select jsonb_agg(to_jsonb(r)) from public.post_reactions r where r.author_id = v_uid), '[]'),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.xp_events x where x.adherent_id = v_uid), '[]'),
    'badges', coalesce((select jsonb_agg(to_jsonb(b)) from public.badges_earned b where b.adherent_id = v_uid), '[]'),
    'challenges', coalesce((select jsonb_agg(to_jsonb(cp)) from public.challenge_participants cp where cp.adherent_id = v_uid), '[]')
  );
end;
$$;
revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;
