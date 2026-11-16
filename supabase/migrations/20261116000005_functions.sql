-- =============================================================================
-- 0005 — Fonctions métier : copie de programmes, application des suggestions,
--        alertes et rappels, notifications automatiques, tableau de bord, export.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Copie de séances et de programmes
-- -----------------------------------------------------------------------------
-- Copie une séance (avec ses exercices et séries) dans un programme.
create or replace function public._copy_workout(
  p_src uuid, p_target_program uuid, p_week integer default null, p_day integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new uuid;
  v_we uuid;
  r record;
begin
  insert into public.workouts (program_id, week_index, day_of_week, name, position, notes)
  select p_target_program, coalesce(p_week, week_index), coalesce(p_day, day_of_week), name, position, notes
  from public.workouts where id = p_src
  returning id into v_new;

  for r in select * from public.workout_exercises where workout_id = p_src order by position loop
    insert into public.workout_exercises (
      workout_id, program_id, exercise_id, position, superset_group, coach_notes, alternative_exercise_ids
    ) values (
      v_new, p_target_program, r.exercise_id, r.position, r.superset_group, r.coach_notes, r.alternative_exercise_ids
    ) returning id into v_we;

    insert into public.prescribed_sets (
      workout_exercise_id, program_id, position, set_type, reps_min, reps_max, load_kg, load_pct_1rm,
      target_rir, target_rpe, rest_seconds, tempo, duration_seconds, notes
    )
    select v_we, p_target_program, position, set_type, reps_min, reps_max, load_kg, load_pct_1rm,
           target_rir, target_rpe, rest_seconds, tempo, duration_seconds, notes
    from public.prescribed_sets where workout_exercise_id = r.id;
  end loop;
  return v_new;
end;
$$;
revoke all on function public._copy_workout(uuid, uuid, integer, integer) from public, anon, authenticated;

-- Copie complète d'un programme.
create or replace function public._copy_program(
  p_src uuid, p_kind public.program_kind, p_adherent uuid, p_start date,
  p_status public.program_status, p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new uuid;
  w record;
begin
  insert into public.programs (kind, name, description, adherent_id, source_template_id, start_date, duration_weeks, status)
  select p_kind, coalesce(p_name, name), description, p_adherent,
         case when kind = 'template' then id else source_template_id end,
         p_start, duration_weeks, p_status
  from public.programs where id = p_src
  returning id into v_new;

  for w in select id from public.workouts where program_id = p_src order by week_index, day_of_week, position loop
    perform public._copy_workout(w.id, v_new);
  end loop;

  insert into public.program_week_adjustments (program_id, week_index, volume_factor, load_factor, note)
  select v_new, week_index, volume_factor, load_factor, note
  from public.program_week_adjustments where program_id = p_src;
  return v_new;
end;
$$;
revoke all on function public._copy_program(uuid, public.program_kind, uuid, date, public.program_status, text)
  from public, anon, authenticated;

-- Assigne un modèle (ou un programme) à un ou plusieurs adhérents : crée une copie
-- personnalisable pour chacun. L'ancien programme en cours passe à « terminé ».
create or replace function public.assign_program(
  p_source uuid, p_adherents uuid[], p_start date, p_activate boolean default true
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := '{}';
  v_id uuid;
  v_adherent uuid;
  v_name text;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select name into v_name from public.programs where id = p_source;
  if v_name is null then
    raise exception 'Programme introuvable';
  end if;
  foreach v_adherent in array p_adherents loop
    if not exists (select 1 from public.profiles where id = v_adherent and role = 'adherent') then
      raise exception 'Adhérent introuvable';
    end if;
    if p_activate then
      update public.programs set status = 'completed'
      where adherent_id = v_adherent and kind = 'assigned' and status = 'active';
    end if;
    v_id := public._copy_program(
      p_source, 'assigned', v_adherent, p_start,
      case when p_activate then 'active'::public.program_status else 'draft'::public.program_status end
    );
    v_ids := v_ids || v_id;
    if p_activate then
      perform public.notify(
        v_adherent, 'program_updated', 'Nouveau programme 💪',
        'Ton coach t''a assigné « ' || v_name || ' ». Il démarre le ' || to_char(p_start, 'DD/MM') || '.',
        jsonb_build_object('program_id', v_id)
      );
    end if;
  end loop;
  return v_ids;
end;
$$;

-- Duplique un programme (en modèle, ou en copie pour le même adhérent en brouillon).
create or replace function public.duplicate_program(p_program uuid, p_as_template boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.programs;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select * into v_src from public.programs where id = p_program;
  if not found then
    raise exception 'Programme introuvable';
  end if;
  if p_as_template or v_src.kind = 'template' then
    return public._copy_program(p_program, 'template', null, null, 'draft', v_src.name || ' (copie)');
  end if;
  return public._copy_program(p_program, 'assigned', v_src.adherent_id, v_src.start_date, 'draft', v_src.name || ' (copie)');
end;
$$;

-- Duplique une séance (vers une autre semaine / un autre jour éventuellement).
create or replace function public.duplicate_workout(
  p_workout uuid, p_week integer default null, p_day integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_program uuid;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select program_id into v_program from public.workouts where id = p_workout;
  if v_program is null then
    raise exception 'Séance introuvable';
  end if;
  return public._copy_workout(p_workout, v_program, p_week, p_day);
end;
$$;

-- Duplique toutes les séances d'une semaine vers une autre semaine.
create or replace function public.duplicate_week(p_program uuid, p_from integer, p_to integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
  v_count integer := 0;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  for w in select id from public.workouts where program_id = p_program and week_index = p_from
           order by day_of_week, position loop
    perform public._copy_workout(w.id, p_program, p_to, null);
    v_count := v_count + 1;
  end loop;
  update public.programs set duration_weeks = greatest(duration_weeks, p_to) where id = p_program;
  return v_count;
end;
$$;

-- Prévient l'adhérent que son programme a été modifié (appelé après un enregistrement).
create or replace function public.notify_program_change(p_program uuid, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prog public.programs;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select * into v_prog from public.programs where id = p_program;
  if v_prog.kind = 'assigned' and v_prog.status = 'active' then
    perform public.notify(
      v_prog.adherent_id, 'program_updated', 'Programme mis à jour',
      coalesce(nullif(trim(p_message), ''), 'Ton coach a modifié ton programme « ' || v_prog.name || ' ».'),
      jsonb_build_object('program_id', p_program)
    );
  end if;
end;
$$;

revoke all on function public.assign_program(uuid, uuid[], date, boolean) from public;
revoke all on function public.duplicate_program(uuid, boolean) from public;
revoke all on function public.duplicate_workout(uuid, integer, integer) from public;
revoke all on function public.duplicate_week(uuid, integer, integer) from public;
revoke all on function public.notify_program_change(uuid, text) from public;
grant execute on function public.assign_program(uuid, uuid[], date, boolean) to authenticated;
grant execute on function public.duplicate_program(uuid, boolean) to authenticated;
grant execute on function public.duplicate_workout(uuid, integer, integer) to authenticated;
grant execute on function public.duplicate_week(uuid, integer, integer) to authenticated;
grant execute on function public.notify_program_change(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Séances à venir d'un exercice dans un programme (cible des suggestions)
-- « À venir » = date prévue aujourd'hui ou plus tard, et pas encore réalisée.
-- -----------------------------------------------------------------------------
create or replace function public._upcoming_workout_exercises(p_program uuid, p_exercise uuid)
returns table (workout_exercise_id uuid, workout_id uuid, workout_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select we.id, w.id, public.workout_date(p.start_date, w.week_index, w.day_of_week)
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  join public.programs p on p.id = w.program_id
  where p.id = p_program
    and we.exercise_id = p_exercise
    and public.workout_date(p.start_date, w.week_index, w.day_of_week) >= current_date
    and not exists (
      select 1 from public.session_logs sl where sl.workout_id = w.id and sl.status = 'completed'
    )
  order by 3, w.position, we.position;
$$;
revoke all on function public._upcoming_workout_exercises(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Application / annulation d'une suggestion
-- -----------------------------------------------------------------------------
-- p_final : valeur modifiée par le coach (sinon la proposition est appliquée telle quelle).
-- Appelée sans utilisateur (service_role) = application automatique.
create or replace function public.apply_suggestion(p_id uuid, p_final jsonb default null)
returns public.suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.suggestions;
  v_value jsonb;
  v_changes jsonb := '[]'::jsonb;
  v_auto boolean := (select auth.uid()) is null;
  r record;
  v_first boolean := true;
  v_week integer;
  v_adj public.program_week_adjustments;
  v_status public.suggestion_status;
begin
  if not v_auto and not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select * into s from public.suggestions where id = p_id for update;
  if not found then
    raise exception 'Suggestion introuvable';
  end if;
  if s.status <> 'pending' then
    raise exception 'Cette suggestion a déjà été traitée';
  end if;
  v_value := coalesce(p_final, s.proposed_value);

  case s.kind
  when 'load' then
    for r in
      select ps.id, ps.load_kg, ps.load_pct_1rm
      from public._upcoming_workout_exercises(s.program_id, s.exercise_id) u
      join public.prescribed_sets ps on ps.workout_exercise_id = u.workout_exercise_id
      where ps.set_type = 'working'
    loop
      v_changes := v_changes || jsonb_build_object(
        't', 'prescribed_sets', 'id', r.id,
        'old', jsonb_build_object('load_kg', r.load_kg, 'load_pct_1rm', r.load_pct_1rm)
      );
      update public.prescribed_sets
      set load_kg = (v_value ->> 'load_kg')::numeric, load_pct_1rm = null
      where id = r.id;
    end loop;

  when 'rep_range' then
    for r in
      select ps.id, ps.reps_min, ps.reps_max
      from public._upcoming_workout_exercises(s.program_id, s.exercise_id) u
      join public.prescribed_sets ps on ps.workout_exercise_id = u.workout_exercise_id
      where ps.set_type = 'working'
    loop
      v_changes := v_changes || jsonb_build_object(
        't', 'prescribed_sets', 'id', r.id,
        'old', jsonb_build_object('reps_min', r.reps_min, 'reps_max', r.reps_max)
      );
      update public.prescribed_sets
      set reps_min = (v_value ->> 'reps_min')::smallint, reps_max = (v_value ->> 'reps_max')::smallint
      where id = r.id;
    end loop;

  when 'variation' then
    for r in
      select we.id, we.exercise_id
      from public._upcoming_workout_exercises(s.program_id, s.exercise_id) u
      join public.workout_exercises we on we.id = u.workout_exercise_id
    loop
      v_changes := v_changes || jsonb_build_object(
        't', 'workout_exercises', 'id', r.id, 'old', jsonb_build_object('exercise_id', r.exercise_id)
      );
      update public.workout_exercises set exercise_id = (v_value ->> 'exercise_id')::uuid where id = r.id;
    end loop;

  when 'reps_target' then
    -- Objectif affiché uniquement sur la prochaine séance contenant l'exercice.
    for r in
      select we.id, we.next_session_hint
      from public._upcoming_workout_exercises(s.program_id, s.exercise_id) u
      join public.workout_exercises we on we.id = u.workout_exercise_id
    loop
      exit when not v_first;
      v_first := false;
      v_changes := v_changes || jsonb_build_object(
        't', 'workout_exercises', 'id', r.id, 'old', jsonb_build_object('next_session_hint', r.next_session_hint)
      );
      update public.workout_exercises set next_session_hint = v_value ->> 'hint' where id = r.id;
    end loop;

  when 'deload' then
    v_week := (v_value ->> 'week_index')::integer;
    select * into v_adj from public.program_week_adjustments
    where program_id = s.program_id and week_index = v_week;
    if found then
      v_changes := v_changes || jsonb_build_object(
        't', 'program_week_adjustments', 'op', 'update', 'id', v_adj.id,
        'old', jsonb_build_object('volume_factor', v_adj.volume_factor, 'load_factor', v_adj.load_factor, 'note', v_adj.note)
      );
      update public.program_week_adjustments
      set volume_factor = coalesce((v_value ->> 'volume_factor')::numeric, 0.5),
          load_factor = coalesce((v_value ->> 'load_factor')::numeric, 1),
          note = 'Semaine de décharge'
      where id = v_adj.id;
    else
      insert into public.program_week_adjustments (program_id, week_index, volume_factor, load_factor, note)
      values (
        s.program_id, v_week, coalesce((v_value ->> 'volume_factor')::numeric, 0.5),
        coalesce((v_value ->> 'load_factor')::numeric, 1), 'Semaine de décharge'
      )
      returning * into v_adj;
      v_changes := v_changes || jsonb_build_object('t', 'program_week_adjustments', 'op', 'insert', 'id', v_adj.id);
    end if;

  when 'info' then
    null; -- simple information : rien à appliquer
  end case;

  v_status := case
    when v_auto then 'auto_applied'
    when p_final is not null and p_final <> s.proposed_value then 'modified'
    else 'accepted'
  end;

  update public.suggestions
  set status = v_status, final_value = v_value, applied_changes = v_changes, decided_at = now()
  where id = p_id
  returning * into s;

  if s.kind <> 'info' and jsonb_array_length(v_changes) > 0 then
    perform public.notify(
      s.adherent_id, 'program_updated', 'Programme ajusté',
      'Ton coach a ajusté ton programme pour tes prochaines séances.',
      jsonb_build_object('program_id', s.program_id, 'suggestion_id', s.id)
    );
  end if;
  return s;
end;
$$;

-- Annule une suggestion appliquée : remet les valeurs d'origine.
create or replace function public.revert_suggestion(p_id uuid)
returns public.suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.suggestions;
  c jsonb;
  v_old jsonb;
  i integer;
begin
  if not public.is_coach() then
    raise exception 'Réservé au coach' using errcode = '42501';
  end if;
  select * into s from public.suggestions where id = p_id for update;
  if not found or s.status not in ('accepted', 'modified', 'auto_applied') then
    raise exception 'Cette suggestion ne peut pas être annulée';
  end if;

  -- On défait les changements dans l'ordre inverse.
  for i in reverse jsonb_array_length(coalesce(s.applied_changes, '[]'::jsonb)) - 1 .. 0 loop
    c := s.applied_changes -> i;
    v_old := c -> 'old';
    if c ->> 't' = 'prescribed_sets' then
      update public.prescribed_sets set
        load_kg = case when v_old ? 'load_kg' then (v_old ->> 'load_kg')::numeric else load_kg end,
        load_pct_1rm = case when v_old ? 'load_pct_1rm' then (v_old ->> 'load_pct_1rm')::numeric else load_pct_1rm end,
        reps_min = case when v_old ? 'reps_min' then (v_old ->> 'reps_min')::smallint else reps_min end,
        reps_max = case when v_old ? 'reps_max' then (v_old ->> 'reps_max')::smallint else reps_max end
      where id = (c ->> 'id')::uuid;
    elsif c ->> 't' = 'workout_exercises' then
      update public.workout_exercises set
        exercise_id = case when v_old ? 'exercise_id' then (v_old ->> 'exercise_id')::uuid else exercise_id end,
        next_session_hint = case when v_old ? 'next_session_hint' then v_old ->> 'next_session_hint' else next_session_hint end
      where id = (c ->> 'id')::uuid;
    elsif c ->> 't' = 'program_week_adjustments' then
      if c ->> 'op' = 'insert' then
        delete from public.program_week_adjustments where id = (c ->> 'id')::uuid;
      else
        update public.program_week_adjustments set
          volume_factor = (v_old ->> 'volume_factor')::numeric,
          load_factor = (v_old ->> 'load_factor')::numeric,
          note = v_old ->> 'note'
        where id = (c ->> 'id')::uuid;
      end if;
    end if;
  end loop;

  update public.suggestions set status = 'reverted', reverted_at = now()
  where id = p_id returning * into s;
  return s;
end;
$$;

revoke all on function public.apply_suggestion(uuid, jsonb) from public, anon;
revoke all on function public.revert_suggestion(uuid) from public, anon;
grant execute on function public.apply_suggestion(uuid, jsonb) to authenticated, service_role;
grant execute on function public.revert_suggestion(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Notifications et alertes automatiques
-- -----------------------------------------------------------------------------
-- Nouveau record → alerte + notification au coach.
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
  -- Le record « volume de séance » est moins parlant : pas d'alerte.
  if new.record_type = 'session_volume' then
    return new;
  end if;
  select name into v_ex from public.exercises where id = new.exercise_id;
  v_msg := public.display_name(new.adherent_id) || ' : nouveau record sur ' || coalesce(v_ex, 'un exercice')
    || case new.record_type
         when 'max_load' then ' (' || trim(to_char(new.value, 'FM999990.##')) || ' kg)'
         when 'estimated_1rm' then ' (1RM estimé ' || trim(to_char(new.value, 'FM999990.#')) || ' kg)'
         else ' (' || trim(to_char(new.value, 'FM999990')) || ' reps à ' || trim(to_char(new.load_kg, 'FM999990.##')) || ' kg)'
       end;
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

create trigger personal_records_after_insert after insert on public.personal_records
  for each row execute function public.on_personal_record();

-- Nouveau bilan → notification au coach ; réponse du coach → notification à l'adhérent.
create or replace function public.on_checkin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(
      public.coach_id(), 'new_checkin', 'Nouveau bilan',
      public.display_name(new.adherent_id) || ' a rempli son bilan hebdo.',
      jsonb_build_object('adherent_id', new.adherent_id, 'checkin_id', new.id)
    );
  elsif new.coach_reply is distinct from old.coach_reply and new.coach_reply is not null then
    perform public.notify(
      new.adherent_id, 'checkin_reply', 'Ton coach a répondu à ton bilan', left(new.coach_reply, 140),
      jsonb_build_object('checkin_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger checkins_after_change after insert or update on public.checkins
  for each row execute function public.on_checkin_change();

-- Lundi de la semaine d'une date.
create or replace function public.week_start(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_date - (extract(isodow from p_date)::integer - 1);
$$;

-- Tâche horaire (planifiée avec pg_cron, voir migration suivante / README) :
--  * rappels de séance et de bilan aux heures choisies par le coach ;
--  * alertes quotidiennes (séance manquée, inactivité, bilan non rempli) à 6 h.
create or replace function public.run_hourly_jobs(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := p_now at time zone 'Europe/Paris';
  v_today date := v_local::date;
  v_hour integer := extract(hour from v_local)::integer;
  v_settings public.app_settings;
  v_count_alerts integer := 0;
  v_count_reminders integer := 0;
  v_inactive_names text[] := '{}';
  r record;
begin
  select * into v_settings from public.app_settings where id = 1;

  -- Rappel de séance (le jour même).
  if v_hour = v_settings.session_reminder_hour then
    for r in
      select distinct on (p.adherent_id) p.adherent_id, w.name
      from public.programs p
      join public.workouts w on w.program_id = p.id
      join public.profiles pr on pr.id = p.adherent_id and pr.is_active
      where p.kind = 'assigned' and p.status = 'active'
        and public.workout_date(p.start_date, w.week_index, w.day_of_week) = v_today
        and not exists (select 1 from public.session_logs sl where sl.workout_id = w.id and sl.status = 'completed')
      order by p.adherent_id, w.position
    loop
      perform public.notify(r.adherent_id, 'session_reminder', 'Séance du jour',
                            'Au programme aujourd''hui : ' || r.name || '. Bonne séance !', '{}'::jsonb);
      v_count_reminders := v_count_reminders + 1;
    end loop;
  end if;

  -- Rappel de bilan (le jour du bilan, s'il n'est pas encore rempli).
  if v_hour = v_settings.checkin_reminder_hour then
    for r in
      select pr.id from public.profiles pr
      where pr.role = 'adherent' and pr.is_active
        and coalesce(pr.checkin_weekday, v_settings.default_checkin_weekday) = extract(isodow from v_today)
        and not exists (
          select 1 from public.checkins c where c.adherent_id = pr.id and c.week_start = public.week_start(v_today)
        )
    loop
      perform public.notify(r.id, 'checkin_reminder', 'Bilan de la semaine',
                            'C''est le jour de ton bilan hebdo : 2 minutes pour faire le point avec ton coach.', '{}'::jsonb);
      v_count_reminders := v_count_reminders + 1;
    end loop;
  end if;

  -- Alertes quotidiennes, à 6 h.
  if v_hour = 6 then
    -- Séances prévues hier et non faites.
    for r in
      select p.adherent_id, w.id as workout_id, w.name
      from public.programs p
      join public.workouts w on w.program_id = p.id
      join public.profiles pr on pr.id = p.adherent_id and pr.is_active
      where p.kind = 'assigned' and p.status = 'active'
        and public.workout_date(p.start_date, w.week_index, w.day_of_week) = v_today - 1
        and not exists (select 1 from public.session_logs sl where sl.workout_id = w.id and sl.status = 'completed')
    loop
      insert into public.alerts (adherent_id, type, message, payload, dedupe_key)
      values (r.adherent_id, 'missed_workout',
              public.display_name(r.adherent_id) || ' n''a pas fait sa séance « ' || r.name || ' » prévue hier.',
              jsonb_build_object('workout_id', r.workout_id), 'missed:' || r.workout_id)
      on conflict (dedupe_key) do nothing;
      v_count_alerts := v_count_alerts + 1;
    end loop;

    -- Adhérents inactifs depuis X jours.
    for r in
      select pr.id,
             (select max(sl.started_at) from public.session_logs sl
              where sl.adherent_id = pr.id and sl.status = 'completed') as last_session,
             pr.created_at
      from public.profiles pr
      where pr.role = 'adherent' and pr.is_active and pr.onboarded_at is not null
    loop
      if coalesce(r.last_session, r.created_at) < p_now - make_interval(days => v_settings.inactivity_days) then
        insert into public.alerts (adherent_id, type, message, payload, dedupe_key)
        values (r.id, 'inactive',
                public.display_name(r.id) || ' n''a pas fait de séance depuis plus de '
                  || v_settings.inactivity_days || ' jours.',
                jsonb_build_object('last_session_at', r.last_session),
                'inactive:' || r.id || ':' || coalesce(r.last_session, r.created_at)::date)
        on conflict (dedupe_key) do nothing;
        if found then
          v_inactive_names := v_inactive_names || public.display_name(r.id);
        end if;
        v_count_alerts := v_count_alerts + 1;
      end if;
    end loop;

    -- Notification groupée pour le coach (pas de spam).
    if array_length(v_inactive_names, 1) > 0 then
      perform public.notify(
        public.coach_id(), 'inactivity', 'Adhérents inactifs',
        array_to_string(v_inactive_names, ', ') || case when array_length(v_inactive_names, 1) > 1
          then ' n''ont' else ' n''a' end || ' pas fait de séance récemment.', '{}'::jsonb
      );
    end if;

    -- Bilan non rempli (le lendemain du jour prévu, même semaine).
    for r in
      select pr.id from public.profiles pr
      where pr.role = 'adherent' and pr.is_active and pr.onboarded_at is not null
        and coalesce(pr.checkin_weekday, v_settings.default_checkin_weekday) = extract(isodow from v_today - 1)
        and not exists (
          select 1 from public.checkins c where c.adherent_id = pr.id and c.week_start = public.week_start(v_today - 1)
        )
    loop
      insert into public.alerts (adherent_id, type, message, payload, dedupe_key)
      values (r.id, 'checkin_missing',
              public.display_name(r.id) || ' n''a pas rempli son bilan hebdo.',
              jsonb_build_object('week_start', public.week_start(v_today - 1)),
              'checkin:' || r.id || ':' || public.week_start(v_today - 1))
      on conflict (dedupe_key) do nothing;
      v_count_alerts := v_count_alerts + 1;
    end loop;
  end if;

  return jsonb_build_object('alerts', v_count_alerts, 'reminders', v_count_reminders);
end;
$$;
revoke all on function public.run_hourly_jobs(timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tableau de bord coach : une ligne par adhérent
-- -----------------------------------------------------------------------------
create or replace function public.coach_overview()
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
  active_program_name text
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
     order by p.start_date desc limit 1)
  from public.profiles pr
  where pr.role = 'adherent'
  order by pr.is_active desc, pr.first_name nulls last;
end;
$$;
revoke all on function public.coach_overview() from public;
grant execute on function public.coach_overview() to authenticated;

-- -----------------------------------------------------------------------------
-- Export RGPD : toutes les données de l'utilisateur connecté
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
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notifications n where n.user_id = v_uid), '[]')
  );
end;
$$;
revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;
