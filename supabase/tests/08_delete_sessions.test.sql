-- Suppression de séances par le coach (même en cours) : séries et records supprimés,
-- séance impossible à recréer par la synchronisation de l'adhérent.
begin;
\ir _helpers.sql
select plan(10);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset

select tests.logout();
insert into public.exercises (id, name, primary_muscle, equipment, type)
values ('00000000-0000-0000-0000-0000000d00e1', 'Squat test', 'quads', 'barbell', 'free_weight');

-- Séance EN COURS d'Alice, avec une série et un record.
select tests.login(:'alice');
insert into public.session_logs (id, adherent_id, started_at, status)
values ('00000000-0000-0000-0000-0000000d0001', :'alice', now(), 'in_progress');
insert into public.set_logs (id, session_log_id, adherent_id, exercise_id, load_kg, reps)
values ('00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000d0001', :'alice',
        '00000000-0000-0000-0000-0000000d00e1', 100, 5);
insert into public.personal_records (id, adherent_id, exercise_id, record_type, value, achieved_at, set_log_id, session_log_id)
values (gen_random_uuid(), :'alice', '00000000-0000-0000-0000-0000000d00e1', 'max_load', 100, now(),
        '00000000-0000-0000-0000-0000000d0002', '00000000-0000-0000-0000-0000000d0001');

-- Ni Alice ni Bob ne peuvent utiliser la suppression du coach.
select throws_ok($$select public.delete_session_log('00000000-0000-0000-0000-0000000d0001')$$,
  '42501', null, 'Alice ne peut pas utiliser la suppression du coach');
select tests.login(:'bob');
select throws_ok($$select public.delete_session_log('00000000-0000-0000-0000-0000000d0001')$$,
  '42501', null, 'Bob ne peut pas supprimer la séance d''Alice');

-- Le coach supprime la séance en cours.
select tests.login(:'coach');
select lives_ok($$select public.delete_session_log('00000000-0000-0000-0000-0000000d0001')$$,
  'Le coach supprime une séance en cours');
select is_empty($$select * from public.session_logs where id = '00000000-0000-0000-0000-0000000d0001'$$,
  'La séance a disparu');
select is_empty($$select * from public.set_logs where session_log_id = '00000000-0000-0000-0000-0000000d0001'$$,
  '… ses séries aussi');
select is_empty($$select * from public.personal_records where exercise_id = '00000000-0000-0000-0000-0000000d00e1'$$,
  '… et le record obtenu pendant cette séance');

-- La synchronisation du téléphone d'Alice ne peut pas la recréer.
select tests.login(:'alice');
select throws_ok(
  format($$insert into public.session_logs (id, adherent_id, started_at, status)
           values ('00000000-0000-0000-0000-0000000d0001', %L, now(), 'completed')$$, :'alice'),
  '42501', null, 'La séance supprimée ne peut pas être recréée par la synchronisation');
select is((select count(*)::int from public.deleted_session_logs), 1,
  'Alice voit que sa séance a été supprimée (pour arrêter la séance sur son téléphone)');
select lives_ok(
  format($$insert into public.session_logs (id, adherent_id, started_at) values (gen_random_uuid(), %L, now())$$, :'alice'),
  'Alice peut toujours enregistrer de nouvelles séances');
select tests.login(:'bob');
select is_empty('select * from public.deleted_session_logs', 'Bob ne voit pas les séances supprimées d''Alice');

select * from finish();
rollback;
