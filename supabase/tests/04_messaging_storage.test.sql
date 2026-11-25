-- Messagerie, notifications, appareils push, stockage des fichiers.
begin;
\ir _helpers.sql
select plan(28);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset
select id as conv_alice from public.conversations where adherent_id = :'alice' \gset
select id as conv_bob from public.conversations where adherent_id = :'bob' \gset

select ok(:'conv_alice' is not null, 'Une conversation est créée automatiquement pour chaque adhérent');

-- Alice ----------------------------------------------------------------------------------
select tests.login(:'alice');
select results_eq('select id from public.conversations', array[:'conv_alice'::uuid], 'Alice ne voit que sa conversation');
select lives_ok(format($$insert into public.messages (id, conversation_id, sender_id, body) values ('00000000-0000-0000-0000-00000000d001', %L, %L, 'Bonjour coach !')$$, :'conv_alice', :'alice'),
  'Alice peut écrire à son coach');
select throws_ok(format($$insert into public.messages (id, conversation_id, sender_id, body) values (gen_random_uuid(), %L, %L, 'Salut Bob')$$, :'conv_bob', :'alice'),
  '42501', null, 'Alice ne peut pas écrire dans la conversation de Bob (pas de messages entre adhérents)');
select throws_ok(format($$insert into public.messages (id, conversation_id, sender_id, body) values (gen_random_uuid(), %L, %L, 'Usurpation')$$, :'conv_alice', :'coach'),
  '42501', null, 'Alice ne peut pas envoyer un message au nom du coach');
select throws_ok($$update public.messages set body = 'modifié' where id = '00000000-0000-0000-0000-00000000d001'$$,
  '42501', null, 'Un message envoyé ne peut pas être modifié');
select throws_ok($$update public.messages set read_at = now() where id = '00000000-0000-0000-0000-00000000d001'$$,
  '42501', null, 'L''expéditeur ne peut pas marquer son propre message comme lu');

-- Coach ----------------------------------------------------------------------------------
select tests.login(:'coach');
select is((select count(*)::int from public.notifications where type = 'new_message'), 1, 'Le coach est notifié du message');
select is((select count(*)::int from public.conversations), 2, 'Le coach voit toutes les conversations');
select lives_ok($$update public.messages set read_at = now() where id = '00000000-0000-0000-0000-00000000d001'$$,
  'Le coach (destinataire) peut marquer le message comme lu');
select lives_ok(format($$insert into public.messages (id, conversation_id, sender_id, body) values (gen_random_uuid(), %L, %L, 'Salut Alice')$$, :'conv_alice', :'coach'),
  'Le coach peut répondre');
select is_empty('select * from public.notifications where type = ''coach_message''', 'Le coach ne voit pas les notifications d''Alice');

-- Bob ------------------------------------------------------------------------------------
select tests.login(:'bob');
select is_empty('select * from public.messages', 'Bob ne voit aucun message d''Alice');
select is_empty('select * from public.notifications', 'Bob ne voit pas les notifications des autres');
select lives_ok(format($$insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[bob]', %L, 'ios')$$, :'bob'),
  'Bob peut enregistrer son téléphone pour les notifications');
select throws_ok(format($$insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[x]', %L, 'ios')$$, :'alice'),
  '42501', null, 'Bob ne peut pas enregistrer un appareil pour Alice');

select tests.login(:'alice');
select is((select count(*)::int from public.notifications where type = 'coach_message'), 1, 'Alice est notifiée de la réponse du coach');
select is_empty('select * from public.push_tokens', 'Alice ne voit pas les appareils de Bob');

-- Préférences : notification désactivée -> rien n'est créé
select tests.logout();
update public.profiles set notification_prefs = '{"coach_message": false}' where id = :'bob';
insert into public.messages (id, conversation_id, sender_id, body) values (gen_random_uuid(), :'conv_bob', :'coach', 'Coucou');
select is((select count(*)::int from public.notifications where user_id = :'bob'), 0,
  'Une notification désactivée par l''adhérent n''est pas créée');

-- Stockage -------------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, owner) values
  ('checkin-photos', :'bob' || '/c1/1.jpg', :'bob'),
  ('message-media', :'bob' || '/m1.mp4', :'bob');

select tests.login(:'alice');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('checkin-photos', %L)$$, :'alice' || '/c1/1.jpg'),
  'Alice peut envoyer une photo de progression dans son dossier');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('checkin-photos', %L)$$, :'bob' || '/c1/2.jpg'),
  '42501', null, 'Alice ne peut pas déposer de fichier dans le dossier de Bob');
select is_empty($$select * from storage.objects where bucket_id in ('checkin-photos', 'message-media') and name like '%' || 'c1/1.jpg' and owner is not null$$,
  'Alice ne voit pas les photos de progression de Bob');
select is_empty(format($$select * from storage.objects where bucket_id = 'message-media' and name = %L$$, :'bob' || '/m1.mp4'),
  'Alice ne voit pas les vidéos envoyées par Bob');

select tests.login(:'coach');
select is((select count(*)::int from storage.objects where bucket_id = 'checkin-photos'), 2, 'Le coach voit les photos de tous les adhérents');


-- Effacer une conversation : coach uniquement
select tests.login(:'alice');
select throws_ok(format($$select public.clear_conversation(%L)$$, :'conv_alice'), '42501', null,
  'Un adhérent ne peut pas effacer une conversation');
select tests.login(:'coach');
select ok(public.clear_conversation(:'conv_alice') >= 2, 'Le coach efface la conversation d''Alice');
select is((select count(*)::int from public.messages where conversation_id = :'conv_alice'), 0,
  '… plus aucun message');
select is((select last_message_at from public.conversations where id = :'conv_alice'), null,
  '… et le fil apparaît comme vide');

select * from finish();
rollback;
