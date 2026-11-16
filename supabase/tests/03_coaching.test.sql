-- Suggestions, alertes, règles, bilans, pesées, assignation de programmes.
begin;
\ir _helpers.sql
select plan(32);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset

insert into public.exercises (id, name, primary_muscle, equipment, type) values
  ('00000000-0000-0000-0000-0000000000e1', 'Développé couché test', 'chest', 'barbell', 'free_weight'),
  ('00000000-0000-0000-0000-0000000000e2', 'Développé haltères test', 'chest', 'dumbbell', 'free_weight');

-- Modèle de 1 semaine avec 2 séances
insert into public.programs (id, kind, name) values ('00000000-0000-0000-0000-00000000f000', 'template', 'PPL');
insert into public.workouts (id, program_id, week_index, day_of_week, name) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000f000', 1, 1, 'Push'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f000', 1, 4, 'Push bis');
insert into public.workout_exercises (id, workout_id, exercise_id) values
  ('00000000-0000-0000-0000-00000000f011', '00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000f012', '00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000e1');
insert into public.prescribed_sets (workout_exercise_id, position, set_type, reps_min, reps_max, load_kg) values
  ('00000000-0000-0000-0000-00000000f011', 0, 'warmup', 10, 10, 30),
  ('00000000-0000-0000-0000-00000000f011', 1, 'working', 8, 12, 60),
  ('00000000-0000-0000-0000-00000000f011', 2, 'working', 8, 12, 60),
  ('00000000-0000-0000-0000-00000000f012', 0, 'working', 8, 12, 60);

-- Assignation (coach) -----------------------------------------------------------------
select tests.login(:'alice');
select throws_ok(format($$select public.assign_program('00000000-0000-0000-0000-00000000f000', array[%L]::uuid[], current_date)$$, :'alice'),
  '42501', null, 'Un adhérent ne peut pas s''assigner un programme');

select tests.login(:'coach');
-- Début dans une semaine : toutes les séances sont « à venir ».
select (public.assign_program('00000000-0000-0000-0000-00000000f000', array[:'alice', :'bob']::uuid[], current_date + 7))[1] as prog_alice \gset
select is((select count(*)::int from public.programs where kind = 'assigned'), 2, 'Le modèle est copié pour chaque adhérent');
select is((select count(*)::int from public.prescribed_sets where program_id = :'prog_alice'), 4, 'Les séries prescrites sont copiées');
select is((select count(*)::int from public.prescribed_sets where program_id = '00000000-0000-0000-0000-00000000f000'), 4, 'Le modèle reste intact');
select tests.login(:'alice');
select is((select count(*)::int from public.notifications where type = 'program_updated'), 1,
  'L''adhérente est notifiée de son nouveau programme');
select tests.login(:'coach');
select is(public.duplicate_week(:'prog_alice', 1, 2), 2, 'Dupliquer une semaine copie ses séances');
select is((select duration_weeks from public.programs where id = :'prog_alice')::int, 4, 'La durée reste cohérente');

-- Suggestions : uniquement le coach ------------------------------------------------------
select tests.logout();
insert into public.suggestions (id, adherent_id, kind, rule_key, exercise_id, program_id, current_value, proposed_value, justification, dedupe_key)
values ('00000000-0000-0000-0000-000000005001', :'alice', 'load', 'double_progression', '00000000-0000-0000-0000-0000000000e1', :'prog_alice',
        '{"load_kg": 60}', '{"load_kg": 62.5}', '3 séances à 12 reps → +2,5 kg', 'test:1');
insert into public.alerts (adherent_id, type, message, dedupe_key) values (:'alice', 'stagnation', 'Stagnation', 'test:a1');

select tests.login(:'alice');
select is_empty('select * from public.suggestions', 'Alice ne voit pas les suggestions');
select is_empty('select * from public.alerts', 'Alice ne voit pas les alertes');
select is_empty('select * from public.progression_rules', 'Alice ne voit pas les règles de progression');
select throws_ok($$select public.apply_suggestion('00000000-0000-0000-0000-000000005001')$$, '42501', null,
  'Alice ne peut pas appliquer une suggestion');

-- Application / annulation par le coach -----------------------------------------------
select tests.login(:'coach');
select is((select count(*)::int from public.progression_rules), 4, 'Le coach voit les règles par défaut');
select is((public.apply_suggestion('00000000-0000-0000-0000-000000005001')).status, 'accepted'::public.suggestion_status,
  'Le coach accepte la suggestion');
select is((select array_agg(distinct load_kg)::numeric[] from public.prescribed_sets where program_id = :'prog_alice' and set_type = 'working'),
  array[62.5]::numeric[], 'La charge des séries de travail à venir passe à 62,5 kg');
select is((select load_kg from public.prescribed_sets where program_id = :'prog_alice' and set_type = 'warmup' limit 1)::numeric,
  30::numeric, 'Les séries d''échauffement ne sont pas modifiées');
select is((select load_kg from public.prescribed_sets ps join public.programs p on p.id = ps.program_id
           where p.adherent_id = :'bob' and set_type = 'working' limit 1)::numeric, 60::numeric,
  'Le programme de Bob n''est pas touché');
select throws_ok($$select public.apply_suggestion('00000000-0000-0000-0000-000000005001')$$, 'P0001', null,
  'Une suggestion ne peut pas être appliquée deux fois');
select is((public.revert_suggestion('00000000-0000-0000-0000-000000005001')).status, 'reverted'::public.suggestion_status,
  'Le coach peut annuler une suggestion appliquée');
select is((select array_agg(distinct load_kg)::numeric[] from public.prescribed_sets where program_id = :'prog_alice' and set_type = 'working'),
  array[60]::numeric[], 'Les charges d''origine sont restaurées');

-- Suggestion modifiée par le coach + décharge
select tests.logout();
insert into public.suggestions (id, adherent_id, kind, rule_key, exercise_id, program_id, proposed_value, justification, dedupe_key) values
  ('00000000-0000-0000-0000-000000005002', :'alice', 'load', 'double_progression', '00000000-0000-0000-0000-0000000000e1', :'prog_alice', '{"load_kg": 65}', 'x', 'test:2'),
  ('00000000-0000-0000-0000-000000005003', :'alice', 'deload', 'fatigue', null, :'prog_alice', '{"week_index": 2, "volume_factor": 0.5}', 'Fatigue', 'test:3'),
  ('00000000-0000-0000-0000-000000005004', :'alice', 'variation', 'stagnation', '00000000-0000-0000-0000-0000000000e1', :'prog_alice', '{"exercise_id": "00000000-0000-0000-0000-0000000000e2"}', 'Stagnation', 'test:4');
select tests.login(:'coach');
select is((public.apply_suggestion('00000000-0000-0000-0000-000000005002', '{"load_kg": 62.5}'::jsonb)).status,
  'modified'::public.suggestion_status, 'Une suggestion modifiée par le coach a le statut « modifiée »');
select is((select max(load_kg) from public.prescribed_sets where program_id = :'prog_alice' and set_type = 'working')::numeric,
  62.5::numeric, '… et c''est la valeur du coach qui est appliquée');
select lives_ok($$select public.apply_suggestion('00000000-0000-0000-0000-000000005003')$$, 'Appliquer une semaine de décharge');
select is((select volume_factor from public.program_week_adjustments where program_id = :'prog_alice' and week_index = 2)::numeric,
  0.5::numeric, 'La semaine 2 est marquée en décharge (volume × 0,5)');
select lives_ok($$select public.revert_suggestion('00000000-0000-0000-0000-000000005003')$$, 'Annuler la décharge');
select is_empty(format($$select * from public.program_week_adjustments where program_id = %L$$, :'prog_alice'), '… la décharge est supprimée');
select lives_ok($$select public.apply_suggestion('00000000-0000-0000-0000-000000005004')$$, 'Appliquer une variante d''exercice');
select is((select count(*)::int from public.workout_exercises where program_id = :'prog_alice' and exercise_id = '00000000-0000-0000-0000-0000000000e2'),
  4, 'L''exercice est remplacé dans toutes les séances à venir');

-- Bilans hebdo et pesées ---------------------------------------------------------------
select tests.login(:'alice');
insert into public.checkins (id, adherent_id, week_start, weight_kg, sleep, energy, stress, soreness, coach_reply)
values ('00000000-0000-0000-0000-00000000c001', :'alice', public.week_start(current_date), 62.4, 4, 3, 2, 2, 'Je me réponds');
select is((select coach_reply from public.checkins where id = '00000000-0000-0000-0000-00000000c001'), null,
  'Alice ne peut pas écrire la réponse du coach');
insert into public.body_weights (id, adherent_id, measured_on, weight_kg) values (gen_random_uuid(), :'alice', current_date, 62.4);

select tests.login(:'bob');
select is_empty('select * from public.checkins', 'Bob ne voit pas le bilan d''Alice');
select is_empty('select * from public.body_weights', 'Bob ne voit pas les pesées d''Alice');

select tests.login(:'coach');
update public.checkins set coach_reply = 'Bravo pour la régularité !' where id = '00000000-0000-0000-0000-00000000c001';
select ok((select coach_replied_at is not null from public.checkins where id = '00000000-0000-0000-0000-00000000c001'),
  'Le coach répond au bilan');
select throws_ok($$update public.checkins set weight_kg = 50 where id = '00000000-0000-0000-0000-00000000c001'$$,
  '42501', null, 'Le coach ne peut pas modifier les données saisies par l''adhérente');

select * from finish();
rollback;
