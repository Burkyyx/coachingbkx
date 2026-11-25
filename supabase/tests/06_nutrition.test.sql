-- Nutrition : objectifs, repas, aliments, consommation IA.
begin;
\ir _helpers.sql
select plan(24);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset

-- Anonyme ---------------------------------------------------------------------------
select tests.login_anon();
select is_empty('select * from public.meals', 'anonyme : aucun repas visible');
select is_empty('select * from public.nutrition_targets', 'anonyme : aucun objectif visible');

-- Alice : ses repas ---------------------------------------------------------------------
select tests.login(:'alice');
select lives_ok(
  format($$insert into public.meals (id, adherent_id, eaten_at, meal_type, kcal, coach_comment)
           values ('00000000-0000-0000-0000-0000000a0001', %L, now(), 'lunch', 650, 'faux commentaire')$$, :'alice'),
  'Alice enregistre un repas');
select is((select coach_comment from public.meals where id = '00000000-0000-0000-0000-0000000a0001'), null,
  'Alice ne peut pas écrire le commentaire du coach');
select throws_ok(
  format($$insert into public.meals (id, adherent_id, eaten_at, meal_type) values (gen_random_uuid(), %L, now(), 'lunch')$$, :'bob'),
  '42501', null, 'Alice ne peut pas créer un repas pour Bob');
select lives_ok(
  format($$insert into public.meal_items (id, meal_id, adherent_id, name, quantity_g, kcal, protein_g)
           values (gen_random_uuid(), '00000000-0000-0000-0000-0000000a0001', %L, 'Riz basmati cuit', 150, 195, 4)$$, :'alice'),
  'Alice ajoute un aliment à son repas');
select throws_ok(
  format($$insert into public.nutrition_targets (adherent_id, kcal) values (%L, 3000)$$, :'alice'),
  '42501', null, 'Alice ne peut pas fixer ses propres objectifs');
select throws_ok(
  format($$insert into public.ai_usage (adherent_id, model, status) values (%L, 'x', 'ok')$$, :'alice'),
  '42501', null, 'Alice ne peut pas écrire dans la consommation IA');
select is(public.ai_analyses_left(), 10, 'Par défaut : 10 analyses photo par jour');

-- Bob : rien chez Alice ---------------------------------------------------------------
select tests.login(:'bob');
select is_empty('select * from public.meals', 'Bob ne voit pas les repas d''Alice');
select is_empty('select * from public.meal_items', 'Bob ne voit pas les aliments d''Alice');
select throws_ok(
  format($$insert into public.meal_items (id, meal_id, adherent_id, name) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000a0001', %L, 'Intrus')$$, :'bob'),
  '42501', null, 'Bob ne peut pas ajouter d''aliment au repas d''Alice');
update public.meals set kcal = 0 where id = '00000000-0000-0000-0000-0000000a0001';
delete from public.meals where id = '00000000-0000-0000-0000-0000000a0001';

-- Coach -------------------------------------------------------------------------------
select tests.login(:'coach');
select is((select kcal from public.meals where id = '00000000-0000-0000-0000-0000000a0001')::numeric, 650::numeric,
  'Le repas d''Alice est intact (Bob n''a rien pu modifier ni supprimer)');
select lives_ok(
  format($$insert into public.nutrition_targets (adherent_id, kcal, protein_g, carbs_g, fat_g, floor_kcal, ai_daily_limit)
           values (%L, 2200, 130, 250, 70, 1400, 3)$$, :'alice'),
  'Le coach fixe les objectifs d''Alice');
select lives_ok(
  $$update public.meals set coach_comment = 'Belle assiette !' where id = '00000000-0000-0000-0000-0000000a0001'$$,
  'Le coach commente un repas');
select isnt((select coach_commented_at from public.meals where id = '00000000-0000-0000-0000-0000000a0001'), null,
  '… la date du commentaire est enregistrée');
select throws_ok(
  $$update public.meals set kcal = 100 where id = '00000000-0000-0000-0000-0000000a0001'$$,
  '42501', null, 'Le coach ne peut pas modifier les chiffres d''un repas');
select is((select count(*)::int from public.meal_items), 1, 'Le coach voit les aliments');

-- Alice voit ses objectifs, pas ceux des autres ; quota IA réglé par le coach -----------
select tests.logout();
insert into public.ai_usage (adherent_id, model, status) values (:'alice', 'claude-haiku-5-5', 'ok');
select tests.login(:'alice');
select is((select kcal from public.nutrition_targets), 2200, 'Alice voit ses objectifs');
select is(public.ai_analyses_left(), 2, 'Le quota tient compte de la limite du coach et des analyses du jour');
select lives_ok(
  $$update public.meals set coach_comment = 'effacé' where id = '00000000-0000-0000-0000-0000000a0001'$$,
  'Alice peut modifier son repas…');
select is((select coach_comment from public.meals where id = '00000000-0000-0000-0000-0000000a0001'), 'Belle assiette !',
  '… sans toucher au commentaire du coach');
select ok((public.export_my_data() -> 'meals') @> '[{"kcal": 650}]'::jsonb, 'L''export RGPD contient les repas');
select tests.login(:'bob');
select is_empty('select * from public.nutrition_targets', 'Bob ne voit pas les objectifs d''Alice');

select * from finish();
rollback;
