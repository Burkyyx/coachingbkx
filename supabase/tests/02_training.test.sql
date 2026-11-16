-- Exercices, programmes, séances réalisées, séries, records.
begin;
\ir _helpers.sql
select plan(29);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset
select tests.create_user('ancien@test.fr', 'adherent', false) as inactive \gset

insert into public.exercises (id, name, primary_muscle, equipment, type)
values ('00000000-0000-0000-0000-0000000000e1', 'Développé couché test', 'chest', 'barbell', 'free_weight');

-- Modèle + programmes assignés
insert into public.programs (id, kind, name, status) values
  ('00000000-0000-0000-0000-00000000aa00', 'template', 'PPL débutant', 'draft');
insert into public.programs (id, kind, name, adherent_id, start_date, status) values
  ('00000000-0000-0000-0000-00000000aa01', 'assigned', 'Programme Alice', :'alice', current_date, 'active'),
  ('00000000-0000-0000-0000-00000000aa02', 'assigned', 'Brouillon Alice', :'alice', current_date, 'draft'),
  ('00000000-0000-0000-0000-00000000bb01', 'assigned', 'Programme Bob', :'bob', current_date, 'active'),
  ('00000000-0000-0000-0000-00000000cc01', 'assigned', 'Programme ancien', :'inactive', current_date, 'active');
insert into public.workouts (id, program_id, week_index, day_of_week, name) values
  ('00000000-0000-0000-0000-00000000aa11', '00000000-0000-0000-0000-00000000aa01', 1, 1, 'Push A'),
  ('00000000-0000-0000-0000-00000000bb11', '00000000-0000-0000-0000-00000000bb01', 1, 1, 'Push B'),
  ('00000000-0000-0000-0000-00000000aa21', '00000000-0000-0000-0000-00000000aa02', 1, 2, 'Brouillon');
insert into public.workout_exercises (id, workout_id, exercise_id) values
  ('00000000-0000-0000-0000-00000000aa12', '00000000-0000-0000-0000-00000000aa11', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000bb12', '00000000-0000-0000-0000-00000000bb11', '00000000-0000-0000-0000-0000000000e1');
insert into public.prescribed_sets (workout_exercise_id, reps_min, reps_max, load_kg, rest_seconds) values
  ('00000000-0000-0000-0000-00000000aa12', 8, 12, 60, 120),
  ('00000000-0000-0000-0000-00000000bb12', 5, 5, 100, 180);
insert into public.reference_1rm (adherent_id, exercise_id, value_kg) values
  (:'alice', '00000000-0000-0000-0000-0000000000e1', 80),
  (:'bob', '00000000-0000-0000-0000-0000000000e1', 120);

-- Bob a déjà une séance
insert into public.session_logs (id, adherent_id, workout_id, started_at, status)
values ('00000000-0000-0000-0000-00000000b5e1', :'bob', '00000000-0000-0000-0000-00000000bb11', now(), 'completed');
insert into public.set_logs (id, session_log_id, adherent_id, exercise_id, load_kg, reps)
values ('00000000-0000-0000-0000-00000000b5e2', '00000000-0000-0000-0000-00000000b5e1', :'bob',
        '00000000-0000-0000-0000-0000000000e1', 100, 5);

-- Le déclencheur a bien rempli program_id
select is((select program_id from public.prescribed_sets where workout_exercise_id = '00000000-0000-0000-0000-00000000aa12'),
  '00000000-0000-0000-0000-00000000aa01'::uuid, 'program_id est rempli automatiquement sur les séries prescrites');

-- Alice -------------------------------------------------------------------------------
select tests.login(:'alice');
select ok((select count(*)::int from public.exercises) > 80, 'Alice voit la bibliothèque d''exercices');
select throws_ok($$insert into public.exercises (name, primary_muscle, equipment, type) values ('Hack', 'quads', 'machine', 'machine')$$,
  '42501', null, 'Alice ne peut pas créer d''exercice');
select results_eq('select id from public.programs', array['00000000-0000-0000-0000-00000000aa01'::uuid],
  'Alice ne voit que son programme actif (ni modèle, ni brouillon, ni celui de Bob)');
select results_eq('select name from public.workouts', array['Push A'], 'Alice ne voit que les séances de son programme');
select is((select count(*)::int from public.prescribed_sets), 1, 'Alice ne voit que ses séries prescrites');
select is((select load_kg from public.prescribed_sets)::numeric, 60::numeric, '… et ce sont bien les siennes');
select results_eq('select value_kg from public.reference_1rm', array[80::numeric(6,2)], 'Alice ne voit que son 1RM');
select throws_ok(format($$insert into public.reference_1rm (adherent_id, exercise_id, value_kg) values (%L, '00000000-0000-0000-0000-0000000000e1', 200)$$, :'alice'),
  '42501', null, 'Alice ne peut pas écrire son 1RM de référence (coach uniquement)');
update public.prescribed_sets set load_kg = 999;
select tests.logout();
select is((select max(load_kg) from public.prescribed_sets)::numeric, 100::numeric, 'Alice ne peut pas modifier son programme');

select tests.login(:'alice');
select is_empty('select * from public.session_logs', 'Alice ne voit pas les séances de Bob');
select is_empty('select * from public.set_logs', 'Alice ne voit pas les séries de Bob');
select lives_ok(format($$insert into public.session_logs (id, adherent_id, workout_id, started_at) values ('00000000-0000-0000-0000-00000000a5e1', %L, '00000000-0000-0000-0000-00000000aa11', now())$$, :'alice'),
  'Alice peut enregistrer une séance');
select lives_ok(format($$insert into public.session_logs (id, adherent_id, workout_id, started_at) values ('00000000-0000-0000-0000-00000000a5e1', %L, '00000000-0000-0000-0000-00000000aa11', now()) on conflict (id) do update set notes = 'rejoué'$$, :'alice'),
  'Rejouer la même séance (synchro) ne crée pas de doublon');
select is((select count(*)::int from public.session_logs), 1, '… une seule séance existe');
select throws_ok(format($$insert into public.session_logs (id, adherent_id, started_at) values (gen_random_uuid(), %L, now())$$, :'bob'),
  '42501', null, 'Alice ne peut pas créer une séance au nom de Bob');
select lives_ok(format($$insert into public.set_logs (id, session_log_id, adherent_id, exercise_id, load_kg, reps, rir, rest_seconds_actual) values ('00000000-0000-0000-0000-00000000a5e2', '00000000-0000-0000-0000-00000000a5e1', %L, '00000000-0000-0000-0000-0000000000e1', 60, 12, 2, 125)$$, :'alice'),
  'Alice peut enregistrer une série (charge, reps, RIR, repos réel)');
select throws_ok(format($$insert into public.set_logs (id, session_log_id, adherent_id, exercise_id, load_kg, reps) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000b5e1', %L, '00000000-0000-0000-0000-0000000000e1', 1, 1)$$, :'alice'),
  '42501', null, 'Alice ne peut pas ajouter une série dans la séance de Bob');
update public.set_logs set reps = 0 where id = '00000000-0000-0000-0000-00000000b5e2';
delete from public.set_logs where id = '00000000-0000-0000-0000-00000000b5e2';
select tests.logout();
select is((select reps from public.set_logs where id = '00000000-0000-0000-0000-00000000b5e2')::int, 5,
  'Alice ne peut ni modifier ni supprimer une série de Bob');

select tests.login(:'alice');
update public.session_logs set analyzed_at = now(), status = 'completed' where id = '00000000-0000-0000-0000-00000000a5e1';
select tests.logout();
select ok((select analyzed_at is null and status = 'completed' from public.session_logs where id = '00000000-0000-0000-0000-00000000a5e1'),
  'Alice ne peut pas modifier le champ technique analyzed_at');

-- Records : visibles par Alice et le coach, alerte + notification au coach
select tests.login(:'alice');
select lives_ok(format($$insert into public.personal_records (id, adherent_id, exercise_id, record_type, value, achieved_at, set_log_id, session_log_id) values (gen_random_uuid(), %L, '00000000-0000-0000-0000-0000000000e1', 'max_load', 60, now(), '00000000-0000-0000-0000-00000000a5e2', '00000000-0000-0000-0000-00000000a5e1')$$, :'alice'),
  'Alice peut enregistrer un record');
select throws_ok(format($$insert into public.personal_records (id, adherent_id, exercise_id, record_type, value, achieved_at, session_log_id) values (gen_random_uuid(), %L, '00000000-0000-0000-0000-0000000000e1', 'max_load', 300, now(), '00000000-0000-0000-0000-00000000b5e1')$$, :'alice'),
  '42501', null, 'Alice ne peut pas rattacher un record à la séance de Bob');
select tests.logout();
select is((select count(*)::int from public.alerts where type = 'new_record' and adherent_id = :'alice'), 1,
  'Un record crée une alerte pour le coach');
select is((select count(*)::int from public.notifications where user_id = :'coach' and type = 'new_record'), 1,
  'Un record crée une notification pour le coach');

-- Bob ne voit pas la séance d'Alice
select tests.login(:'bob');
select results_eq('select id from public.session_logs', array['00000000-0000-0000-0000-00000000b5e1'::uuid],
  'Bob ne voit que ses propres séances');
select is_empty('select * from public.personal_records', 'Bob ne voit pas les records d''Alice');

-- Adhérent désactivé : plus aucun accès
select tests.login(:'inactive');
select is_empty('select * from public.programs', 'Un adhérent désactivé ne voit plus son programme');
select throws_ok(format($$insert into public.session_logs (id, adherent_id, started_at) values (gen_random_uuid(), %L, now())$$, :'inactive'),
  '42501', null, 'Un adhérent désactivé ne peut plus enregistrer de séance');

-- Coach
select tests.login(:'coach');
select is((select count(*)::int from public.set_logs), 2, 'Le coach voit toutes les séries de tous les adhérents');

select * from finish();
rollback;
