-- Vérifications globales : RLS partout, buckets privés, tâches planifiées.
begin;
\ir _helpers.sql
select plan(11);

-- Aucune table du schéma public sans RLS (protège aussi les futures tables).
select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  'Toutes les tables du schéma public ont la RLS activée');

select is_empty($$select id from storage.buckets where public$$, 'Aucun bucket de stockage n''est public');

-- Les fonctions internes ne sont pas appelables depuis l'app.
select ok(not has_function_privilege('authenticated', 'public.notify(uuid, text, text, text, jsonb)', 'execute'),
  'notify() n''est pas appelable par un utilisateur');
select ok(not has_function_privilege('authenticated', 'public.run_hourly_jobs(timestamptz)', 'execute'),
  'run_hourly_jobs() n''est pas appelable par un utilisateur');
select ok(not has_function_privilege('anon', 'public.redeem_invitation(text)', 'execute'),
  'Un visiteur non connecté ne peut pas utiliser d''invitation');

-- Tâche horaire : alerte « séance manquée » et « inactivité »
select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
update public.profiles set created_at = now() - interval '30 days' where id = :'alice';
insert into public.programs (id, kind, name, adherent_id, start_date, status)
values ('00000000-0000-0000-0000-00000000aa01', 'assigned', 'P', :'alice', current_date - 1, 'active');
insert into public.workouts (program_id, week_index, day_of_week, name)
values ('00000000-0000-0000-0000-00000000aa01', 1, extract(isodow from current_date - 1)::smallint, 'Jambes');

select public.run_hourly_jobs((current_date + time '06:10') at time zone 'Europe/Paris');
select is((select count(*)::int from public.alerts where type = 'missed_workout'), 1, 'Alerte « séance prévue non faite »');
select is((select count(*)::int from public.alerts where type = 'inactive'), 1, 'Alerte « adhérent inactif »');

-- Statistiques du tableau de bord : réservées au coach
select ok(not has_function_privilege('anon', 'public.coach_weekly_stats(integer)', 'execute'),
  'Un visiteur non connecté ne peut pas lire les statistiques');
select tests.login(:'alice');
select throws_ok('select * from public.coach_weekly_stats(4)', '42501', null,
  'Un adhérent ne peut pas lire les statistiques du coach');
select throws_ok('select * from public.coach_overview()', '42501', null,
  'Un adhérent ne peut pas lire la vue d''ensemble du coach');
select tests.login(:'coach');
select is((select count(*)::int from public.coach_weekly_stats(4)), 4,
  'Le coach lit ses statistiques (une ligne par semaine)');
select tests.logout();

select * from finish();
rollback;
