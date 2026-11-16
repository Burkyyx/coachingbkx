-- -----------------------------------------------------------------------------
-- 1. Vue d'ensemble coach : ajoute les infos utiles aux filtres
--    (date de naissance, sexe, niveau, activité au quotidien).
--    Le type de retour change : on supprime puis recrée la fonction.
-- -----------------------------------------------------------------------------
drop function if exists public.coach_overview();

create function public.coach_overview()
returns table (
  adherent_id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_path text,
  goal public.training_goal,
  is_active boolean,
  onboarded boolean,
  last_session_at timestamptz,
  sessions_planned_28d integer,
  sessions_done_28d integer,
  pending_suggestions integer,
  unseen_alerts integer,
  last_checkin_week date,
  recent_weights jsonb,
  active_program_name text,
  birth_date date,
  sex public.sex,
  level public.training_level,
  activity_level public.activity_level
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  return query
  with planned as (
    select p.adherent_id, w.id as workout_id
    from public.programs p
    join public.workouts w on w.program_id = p.id
    where p.kind = 'assigned' and p.status in ('active', 'completed')
      and public.workout_date(p.start_date, w.week_index, w.day_of_week)
          between current_date - 28 and current_date - 1
  )
  select
    pr.id, pr.first_name, pr.last_name, pr.nickname, pr.avatar_path, pr.goal, pr.is_active,
    pr.onboarded_at is not null,
    (select max(sl.started_at) from public.session_logs sl where sl.adherent_id = pr.id and sl.status = 'completed'),
    (select count(*)::integer from planned pl where pl.adherent_id = pr.id),
    (select count(*)::integer from planned pl where pl.adherent_id = pr.id and exists (
       select 1 from public.session_logs sl where sl.workout_id = pl.workout_id and sl.status = 'completed')),
    (select count(*)::integer from public.suggestions s where s.adherent_id = pr.id and s.status = 'pending'),
    (select count(*)::integer from public.alerts a where a.adherent_id = pr.id and a.seen_at is null),
    (select max(c.week_start) from public.checkins c where c.adherent_id = pr.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('date', bw.measured_on, 'kg', bw.weight_kg) order by bw.measured_on)
      from public.body_weights bw where bw.adherent_id = pr.id and bw.measured_on >= current_date - 42
    ), '[]'::jsonb),
    (select p.name from public.programs p where p.adherent_id = pr.id and p.kind = 'assigned' and p.status = 'active'
     order by p.start_date desc limit 1),
    pr.birth_date, pr.sex, pr.level, pr.activity_level
  from public.profiles pr
  where pr.role = 'adherent'
  order by pr.is_active desc, pr.first_name nulls last;
end;
$$;
revoke all on function public.coach_overview() from public;
grant execute on function public.coach_overview() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Statistiques hebdomadaires du tableau de bord (semaines du lundi au dimanche)
--    Une ligne par semaine, de la plus ancienne à la semaine en cours.
-- -----------------------------------------------------------------------------
create function public.coach_weekly_stats(p_weeks integer default 8)
returns table (
  week_start date,
  sessions_planned integer,
  sessions_done integer,
  active_adherents integer,
  records integer,
  checkins_received integer,
  checkins_expected integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_weeks integer := least(greatest(coalesce(p_weeks, 8), 1), 52);
  v_current date := date_trunc('week', current_date)::date;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  return query
  with weeks as (
    select (v_current - (7 * g))::date as ws
    from generate_series(0, v_weeks - 1) as g
  ),
  planned as (
    select p.adherent_id, w.id as workout_id,
           public.workout_date(p.start_date, w.week_index, w.day_of_week) as day
    from public.programs p
    join public.workouts w on w.program_id = p.id
    join public.profiles pr on pr.id = p.adherent_id and pr.is_active
    where p.kind = 'assigned' and p.status in ('active', 'completed')
  ),
  -- Adhérents actifs ayant terminé leur inscription : attendus pour le bilan.
  expected as (
    select count(*)::integer as n
    from public.profiles pr
    where pr.role = 'adherent' and pr.is_active and pr.onboarded_at is not null
  )
  select
    wk.ws,
    (select count(*)::integer from planned pl where pl.day between wk.ws and wk.ws + 6),
    (select count(*)::integer from public.session_logs sl
       where sl.status = 'completed'
         and sl.started_at >= wk.ws and sl.started_at < wk.ws + 7),
    (select count(distinct sl.adherent_id)::integer from public.session_logs sl
       where sl.status = 'completed'
         and sl.started_at >= wk.ws and sl.started_at < wk.ws + 7),
    (select count(*)::integer from public.personal_records r
       where r.record_type <> 'session_volume'
         and r.achieved_at >= wk.ws and r.achieved_at < wk.ws + 7),
    (select count(*)::integer from public.checkins c where c.week_start = wk.ws),
    (select n from expected)
  from weeks wk
  order by wk.ws;
end;
$$;
revoke all on function public.coach_weekly_stats(integer) from public;
grant execute on function public.coach_weekly_stats(integer) to authenticated;
