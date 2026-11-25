-- Nutrition (étape 5) : suggestion « calories » appliquée / annulée, commentaire du coach notifié.
begin;
\ir _helpers.sql
select plan(10);

select tests.create_user('coach@test.fr', 'coach') as coach \gset
select tests.create_user('alice@test.fr') as alice \gset
select tests.create_user('bob@test.fr') as bob \gset

-- Objectifs d'Alice et une suggestion « calories » en attente (créées par le serveur).
select tests.logout();
insert into public.nutrition_targets (adherent_id, kcal, protein_g, carbs_g, fat_g, floor_kcal)
values (:'alice', 2200, 140, 240, 70, 1500);
insert into public.suggestions (id, adherent_id, kind, rule_key, current_value, proposed_value, justification, dedupe_key)
values (
  '00000000-0000-0000-0000-0000000c0001', :'alice', 'calories', 'calorie_adjustment',
  '{"kcal": 2200, "protein_g": 140, "carbs_g": 240, "fat_g": 70}',
  '{"kcal": 2050, "protein_g": 140, "carbs_g": 203, "fat_g": 70}',
  'Poids stable en sèche → −150 kcal', 'calories:test'
);
insert into public.meals (id, adherent_id, eaten_at, meal_type, kcal)
values ('00000000-0000-0000-0000-0000000c0002', :'alice', now(), 'lunch', 600);

-- Un adhérent ne peut pas appliquer une suggestion ---------------------------------------
select tests.login(:'alice');
select throws_ok(
  $$select public.apply_suggestion('00000000-0000-0000-0000-0000000c0001')$$,
  '42501', null, 'Alice ne peut pas appliquer une suggestion');

-- Le coach applique une version modifiée (plancher respecté) -------------------------------
select tests.login(:'coach');
select lives_ok(
  $$select public.apply_suggestion('00000000-0000-0000-0000-0000000c0001',
      '{"kcal": 1400, "protein_g": 140, "carbs_g": 290, "fat_g": 70}'::jsonb)$$,
  'Le coach applique un ajustement modifié');
select is((select kcal from public.nutrition_targets where adherent_id = :'alice'), 1500,
  'Le plancher (1 500 kcal) est respecté même si le coach saisit moins');
select is((select status::text from public.suggestions where id = '00000000-0000-0000-0000-0000000c0001'), 'modified',
  'La suggestion est marquée « modifiée »');

-- Annulation : retour aux anciennes valeurs ----------------------------------------------
select lives_ok($$select public.revert_suggestion('00000000-0000-0000-0000-0000000c0001')$$,
  'Le coach annule l''ajustement');
select results_eq(
  format($$select kcal, protein_g::int, carbs_g::int, fat_g::int from public.nutrition_targets where adherent_id = %L$$, :'alice'),
  $$values (2200, 140, 240, 70)$$,
  'Les objectifs reviennent aux valeurs d''avant');

-- Commentaire du coach → notification à l'adhérent -----------------------------------------
select lives_ok(
  $$update public.meals set coach_comment = 'Pense aux légumes 🙂' where id = '00000000-0000-0000-0000-0000000c0002'$$,
  'Le coach commente un repas');

select tests.login(:'alice');
select is((select count(*)::int from public.notifications where type = 'nutrition_updated'), 1,
  'Alice est prévenue de l''ajustement de ses objectifs');
select is((select body from public.notifications where type = 'meal_comment'), 'Pense aux légumes 🙂',
  'Alice est prévenue du commentaire du coach');
select tests.login(:'bob');
select is_empty($$select * from public.notifications where type in ('meal_comment', 'nutrition_updated')$$,
  'Bob ne voit pas les notifications d''Alice');

select * from finish();
rollback;
