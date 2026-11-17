-- -----------------------------------------------------------------------------
-- Suggestion « viser +1 rep » : en plus du message affiché à l'adhérent, l'objectif
-- de reps est enregistré et pré-rempli dans la prochaine séance concernée.
-- (Les suggestions ne modifient que le programme ASSIGNÉ de l'adhérent, jamais le modèle.)
-- -----------------------------------------------------------------------------
alter table public.workout_exercises
  add column if not exists next_session_target_reps smallint
  check (next_session_target_reps is null or next_session_target_reps between 1 and 100);

comment on column public.workout_exercises.next_session_target_reps is
  'Objectif de reps de la prochaine séance (suggestion acceptée) : pré-rempli en séance.';

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
      select we.id, we.next_session_hint, we.next_session_target_reps
      from public._upcoming_workout_exercises(s.program_id, s.exercise_id) u
      join public.workout_exercises we on we.id = u.workout_exercise_id
    loop
      exit when not v_first;
      v_first := false;
      v_changes := v_changes || jsonb_build_object(
        't', 'workout_exercises', 'id', r.id,
        'old', jsonb_build_object(
          'next_session_hint', r.next_session_hint,
          'next_session_target_reps', r.next_session_target_reps
        )
      );
      -- Objectif affiché ET reps pré-remplies à cette valeur en séance.
      update public.workout_exercises
      set next_session_hint = v_value ->> 'hint',
          next_session_target_reps = (v_value ->> 'reps')::smallint
      where id = r.id;
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
        next_session_hint = case when v_old ? 'next_session_hint' then v_old ->> 'next_session_hint' else next_session_hint end,
        next_session_target_reps = case when v_old ? 'next_session_target_reps'
          then (v_old ->> 'next_session_target_reps')::smallint else next_session_target_reps end
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
