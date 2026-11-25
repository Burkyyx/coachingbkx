-- Communauté : adhésion (consentement), posts, modération, XP, badges, challenges,
-- et étanchéité absolue des données de poids et de nutrition.
begin;
\ir _helpers.sql
select plan(36);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('carol@test.fr') as carol \gset
select tests.create_user('bob@test.fr') as bob \gset

-- Données privées d'Alice (ne doivent JAMAIS être visibles par la communauté).
select tests.logout();
insert into public.body_weights (id, adherent_id, measured_on, weight_kg)
values (gen_random_uuid(), :'alice', current_date, 72.4);
insert into public.meals (id, adherent_id, eaten_at, meal_type, kcal) values (gen_random_uuid(), :'alice', now(), 'lunch', 640);
insert into public.consents (user_id, type, version) values (:'carol', 'community', '1.0');

-- Adhésion -------------------------------------------------------------------------------
select tests.login(:'alice');
select throws_ok(
  format($$insert into public.community_members (adherent_id, display_name) values (%L, 'Alice')$$, :'alice'),
  '42501', null, 'Sans consentement « communauté », impossible de rejoindre');
insert into public.consents (user_id, type, version) values (:'alice', 'community', '1.0');
select lives_ok(
  format($$insert into public.community_members (adherent_id, display_name, auto_posts) values (%L, 'Alice', true)$$, :'alice'),
  'Avec le consentement, Alice rejoint la communauté (posts automatiques activés)');
select throws_ok(
  format($$update public.community_members set suspended_at = now() where adherent_id = %L$$, :'alice'),
  '42501', null, 'Un membre ne peut pas modifier sa suspension');
select tests.login(:'carol');
insert into public.community_members (adherent_id, display_name) values (:'carol', 'Caro');

-- Posts ------------------------------------------------------------------------------------
select tests.login(:'alice');
select lives_ok($$insert into public.posts (id, author_id, body) values ('00000000-0000-0000-0000-0000000f0001', auth.uid(), 'Première séance validée !')$$,
  'Alice publie un post');
select throws_ok($$insert into public.posts (author_id, body) values (auth.uid(), 'espèce de connard')$$,
  '22023', null, 'Les mots interdits sont refusés');
select lives_ok($$insert into public.posts (author_id, body) values (auth.uid(), 'Un nouveau député au club')$$,
  'Pas de faux positif sur un mot qui en contient un autre');
select throws_ok($$insert into public.posts (author_id, kind, payload) values (auth.uid(), 'record', '{}')$$,
  '42501', null, 'Un membre ne peut pas fabriquer un post automatique');
select throws_ok($$update public.posts set hidden_at = now() where id = '00000000-0000-0000-0000-0000000f0001'$$,
  '42501', null, 'Un membre ne peut pas masquer un post (réservé au coach)');

select tests.login(:'carol');
select is((select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000f0001'), 1,
  'Carol (membre) voit le post d''Alice');
select lives_ok($$insert into public.post_reactions (post_id, author_id, emoji) values ('00000000-0000-0000-0000-0000000f0001', auth.uid(), '💪')$$,
  'Carol réagit 💪');
select throws_ok($$insert into public.post_reactions (post_id, author_id, emoji) values ('00000000-0000-0000-0000-0000000f0001', auth.uid(), '💩')$$,
  '23514', null, 'Seules les réactions prévues sont acceptées');
select lives_ok($$insert into public.post_comments (post_id, author_id, body) values ('00000000-0000-0000-0000-0000000f0001', auth.uid(), 'Bravo !')$$,
  'Carol commente');
select lives_ok($$insert into public.community_reports (reporter_id, post_id, reason) values (auth.uid(), '00000000-0000-0000-0000-0000000f0001', 'test')$$,
  'Carol signale un post');

-- Bob n'est pas membre : il ne voit rien.
select tests.login(:'bob');
select is_empty('select * from public.posts', 'Un non-membre ne voit aucun post');
select is_empty('select * from public.community_people()', 'Un non-membre ne voit pas les membres');
select throws_ok($$insert into public.posts (author_id, body) values (auth.uid(), 'Salut')$$,
  '42501', null, 'Un non-membre ne peut pas publier');

-- Étanchéité poids / nutrition entre membres ------------------------------------------------
select tests.login(:'carol');
select is_empty('select * from public.body_weights', 'Un membre ne voit pas le poids des autres');
select is_empty('select * from public.meals', 'Un membre ne voit pas les repas des autres');
select is_empty('select * from public.xp_events', 'Un membre ne voit pas le détail des XP des autres');
select is_empty('select * from public.community_reports where reporter_id <> auth.uid()',
  'Un membre ne voit pas les signalements des autres');
select ok(
  not exists (
    select 1 from public.community_people() p
    where to_jsonb(p)::text ~* '(weight|kcal|poids|meal|repas|72\.4|640)'
  ),
  'Les profils publics ne contiennent ni poids ni nutrition');

-- Modération ---------------------------------------------------------------------------------
select tests.login(:'coach');
select is((select count(*)::int from public.community_reports), 1, 'Le coach voit les signalements');
select lives_ok($$update public.posts set hidden_at = now() where id = '00000000-0000-0000-0000-0000000f0001'$$,
  'Le coach masque le post');
select tests.login(:'carol');
select is((select count(*)::int from public.posts where id = '00000000-0000-0000-0000-0000000f0001'), 0,
  'Un post masqué n''est plus visible des autres membres');

-- XP, badges, posts automatiques, challenge ----------------------------------------------------
select tests.login(:'coach');
insert into public.challenges (id, title, metric, target, starts_on, ends_on, xp_reward)
values ('00000000-0000-0000-0000-0000000fc001', '1 séance cette semaine', 'sessions', 1, current_date - 1, current_date + 6, 40);
select tests.login(:'alice');
select lives_ok($$insert into public.challenge_participants (challenge_id, adherent_id) values ('00000000-0000-0000-0000-0000000fc001', auth.uid())$$,
  'Alice rejoint le challenge');
insert into public.session_logs (id, adherent_id, started_at, status)
values ('00000000-0000-0000-0000-0000000f5e51', :'alice', now(), 'in_progress');
update public.session_logs set status = 'completed' where id = '00000000-0000-0000-0000-0000000f5e51';
select is((select points from public.xp_events where kind = 'session'), 20, 'Séance terminée : 20 XP');
select ok(exists (select 1 from public.badges_earned where badge_key = 'first_session'), 'Badge « première séance »');
select isnt((select completed_at from public.challenge_participants where challenge_id = '00000000-0000-0000-0000-0000000fc001'), null,
  'Challenge réussi automatiquement à partir de la séance');
select is((select points from public.xp_events where kind = 'challenge'), 40, 'Le challenge rapporte sa récompense en XP');
select ok(exists (select 1 from public.posts where kind = 'session' and author_id = auth.uid()),
  'Post automatique « séance terminée » (activé par Alice)');
insert into public.meals (id, adherent_id, eaten_at, meal_type) values (gen_random_uuid(), :'alice', now(), 'dinner');
select is((select points from public.xp_events where kind = 'journal_day'), 10,
  'Journal tenu (2 repas notés) : 10 XP, sans aucun chiffre pris en compte');
select is((select sum(points)::int from public.xp_events), 70, 'Total Alice : 20 + 40 + 10 = 70 XP (sous le plafond)');


-- Séance d'un programme (semaine complète) et record battu --------------------------------------
select tests.logout();
insert into public.exercises (id, name, primary_muscle, equipment, type)
values ('00000000-0000-0000-0000-0000000fe001', 'Squat communauté', 'quads', 'barbell', 'free_weight');
insert into public.programs (id, kind, name, adherent_id, start_date, status)
values ('00000000-0000-0000-0000-0000000fa001', 'assigned', 'Prog test', :'alice', current_date, 'active');
insert into public.workouts (id, program_id, week_index, day_of_week, name)
values ('00000000-0000-0000-0000-0000000fb001', '00000000-0000-0000-0000-0000000fa001', 1, 1, 'Jambes');
update public.app_settings set xp_rules = xp_rules || '{"daily_cap": 1000}';
select tests.login(:'alice');
insert into public.session_logs (id, adherent_id, workout_id, program_id, started_at, status)
values ('00000000-0000-0000-0000-0000000f5e52', :'alice', '00000000-0000-0000-0000-0000000fb001',
        '00000000-0000-0000-0000-0000000fa001', now(), 'completed');
select is((select points from public.xp_events where kind = 'full_week'), 30,
  'Toutes les séances de la semaine du programme faites : 30 XP');
insert into public.set_logs (id, session_log_id, adherent_id, exercise_id, load_kg, reps)
values ('00000000-0000-0000-0000-0000000f5e53', '00000000-0000-0000-0000-0000000f5e52', :'alice',
        '00000000-0000-0000-0000-0000000fe001', 100, 5);
insert into public.personal_records (id, adherent_id, exercise_id, record_type, value, load_kg, achieved_at, set_log_id, session_log_id)
select gen_random_uuid(), :'alice', '00000000-0000-0000-0000-0000000fe001', t, 100, 100, now(),
       '00000000-0000-0000-0000-0000000f5e53', '00000000-0000-0000-0000-0000000f5e52'
from unnest(array['max_load', 'estimated_1rm', 'reps_at_load', 'session_volume']::public.record_type[]) t;
select is((select count(*)::int from public.xp_events where kind = 'record' and points > 0), 3,
  '4 records dans la séance : seuls 3 sont récompensés (anti-abus)');
select is((select count(*)::int from public.posts where kind = 'record' and author_id = auth.uid()), 1,
  'Un seul post « record » par exercice et par séance');
select ok(exists (select 1 from public.badges_earned where badge_key = 'first_record'), 'Badge « premier record »');

select * from finish();
rollback;
