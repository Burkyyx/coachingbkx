-- Profils, invitations, consentements, notes du coach, réglages.
begin;
\ir _helpers.sql
select plan(29);

-- Données de test ---------------------------------------------------------------
select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset
select tests.create_user('ancien@test.fr', 'adherent', false) as inactive \gset
insert into public.coach_notes (adherent_id, body) values (:'alice', 'Genou fragile, attention aux fentes');

-- Anonyme -----------------------------------------------------------------------
select tests.login_anon();
select is_empty('select * from public.profiles', 'anonyme : aucun profil visible');
select is((select count(*)::int from public.invitations), 0, 'anonyme : aucune invitation visible');

-- Adhérente Alice -------------------------------------------------------------------
select tests.login(:'alice');
select results_eq('select id from public.profiles', array[:'alice'::uuid], 'Alice ne voit que son propre profil');
select lives_ok(
  format($$update public.profiles set first_name = 'Alice', height_cm = 168 where id = %L$$, :'alice'),
  'Alice peut modifier ses informations');
select throws_ok(
  format($$update public.profiles set role = 'coach' where id = %L$$, :'alice'),
  '42501', null, 'Alice ne peut pas se donner le rôle coach');
select throws_ok(
  format($$update public.profiles set effort_scale = 'rpe' where id = %L$$, :'alice'),
  '42501', null, 'Alice ne peut pas changer son échelle d''effort (réglage coach)');
update public.profiles set first_name = 'Pirate' where id = :'bob';
select tests.logout();
select isnt((select first_name from public.profiles where id = :'bob'), 'Pirate', 'Alice ne peut pas modifier le profil de Bob');

select tests.login(:'alice');
select is_empty('select * from public.coach_notes', 'Alice ne voit pas les notes privées du coach');
select throws_ok(
  format($$insert into public.coach_notes (adherent_id, body) values (%L, 'x')$$, :'alice'),
  '42501', null, 'Alice ne peut pas écrire de note coach');
select is_empty('select * from public.invitations', 'Alice ne voit pas les invitations');
select throws_ok('select public.create_invitation(''test'')', '42501', null, 'Alice ne peut pas créer d''invitation');
select throws_ok('select public.bootstrap_coach(''alice@test.fr'')', '42501', null, 'Alice ne peut pas appeler bootstrap_coach');
update public.app_settings set inactivity_days = 30;
select is((select inactivity_days from public.app_settings)::int, 5, 'Alice ne peut pas modifier les réglages du coach');

-- Consentements
select lives_ok(
  format($$insert into public.consents (user_id, type, version) values (%L, 'terms', '1.0')$$, :'alice'),
  'Alice peut accorder un consentement');
select throws_ok(
  format($$insert into public.consents (user_id, type, version) values (%L, 'terms', '1.0')$$, :'bob'),
  '42501', null, 'Alice ne peut pas accorder un consentement pour Bob');
select lives_ok(
  format($$update public.consents set revoked_at = now() where user_id = %L and type = 'terms'$$, :'alice'),
  'Alice peut révoquer son consentement');
select throws_ok(
  format($$update public.consents set revoked_at = null where user_id = %L and type = 'terms'$$, :'alice'),
  '42501', null, 'Un consentement révoqué ne peut pas être « dé-révoqué »');

-- Bob ne voit pas les consentements d'Alice
select tests.login(:'bob');
select is_empty('select * from public.consents', 'Bob ne voit pas les consentements d''Alice');

-- Adhérent désactivé ------------------------------------------------------------------
select tests.login(:'inactive');
update public.profiles set first_name = 'X' where id = :'inactive';
select tests.logout();
select isnt((select first_name from public.profiles where id = :'inactive'), 'X',
  'Un adhérent désactivé ne peut pas modifier son profil');
select tests.login(:'inactive');
select is_empty('select * from public.app_settings', 'Un adhérent désactivé ne lit plus les réglages');

-- Coach ---------------------------------------------------------------------------------
select tests.login(:'coach');
select is((select count(*)::int from public.profiles), 4, 'Le coach voit tous les profils');
select is((select count(*)::int from public.coach_notes), 1, 'Le coach voit ses notes');
select lives_ok(
  format($$update public.profiles set effort_scale = 'rpe', is_active = true where id = %L$$, :'alice'),
  'Le coach peut régler l''échelle d''effort et réactiver un compte');
select code, label from public.create_invitation('Pour Chloé') \gset
select is(:'label'::text, 'Pour Chloé'::text, 'Le coach peut créer une invitation');
select ok(:'code' ~ '^[A-Z0-9]{8}$', 'Le code d''invitation fait 8 caractères');

-- Utilisation de l'invitation par une nouvelle personne ---------------------------------
select tests.logout();
select tests.create_auth_only('chloe@test.fr') as chloe \gset
select tests.login_anon();
select ok(public.check_invitation(:'code'), 'Le code est valide avant utilisation (anonyme)');
select tests.login(:'chloe');
select is((public.redeem_invitation(lower(:'code'))).role, 'adherent'::public.user_role,
  'Chloé devient adhérente avec le code (insensible à la casse)');
select tests.logout();
select tests.create_auth_only('intrus@test.fr') as intrus \gset
select tests.login(:'intrus');
select throws_ok(format('select public.redeem_invitation(%L)', :'code'), 'P0001', 'invitation_invalide',
  'Un code déjà utilisé est refusé');
select ok(not public.check_invitation(:'code'), 'Le code n''est plus valide après utilisation');

select * from finish();
rollback;
