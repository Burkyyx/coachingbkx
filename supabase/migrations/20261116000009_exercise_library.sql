-- =============================================================================
-- 0009 — Bibliothèque de départ : ~80 exercices courants (sans vidéo).
-- Incrément de charge : 2,5 kg haut du corps, 5 kg bas du corps, plus petit
-- saut d'haltères pour les haltères. Le coach peut tout modifier ensuite.
-- =============================================================================
insert into public.exercises (name, primary_muscle, secondary_muscles, equipment, type, load_increment_kg, instructions)
values
  -- Pectoraux
  ('Développé couché barre', 'chest', '{triceps,shoulders}', 'barbell', 'free_weight', 2.5, 'Omoplates serrées, pieds ancrés au sol, barre descendue au bas des pectoraux.'),
  ('Développé couché haltères', 'chest', '{triceps,shoulders}', 'dumbbell', 'free_weight', 2, 'Coudes à environ 45°, amplitude complète sans choc en bas.'),
  ('Développé incliné barre', 'chest', '{shoulders,triceps}', 'barbell', 'free_weight', 2.5, 'Banc incliné à 30°, barre vers le haut des pectoraux.'),
  ('Développé incliné haltères', 'chest', '{shoulders,triceps}', 'dumbbell', 'free_weight', 2, 'Banc à 30°, descente contrôlée.'),
  ('Développé décliné barre', 'chest', '{triceps}', 'barbell', 'free_weight', 2.5, null),
  ('Développé couché à la machine', 'chest', '{triceps,shoulders}', 'machine', 'machine', 5, null),
  ('Écarté haltères', 'chest', '{shoulders}', 'dumbbell', 'free_weight', 2, 'Bras légèrement fléchis, ouverture contrôlée.'),
  ('Écarté à la poulie vis-à-vis', 'chest', '{shoulders}', 'cable', 'machine', 2.5, null),
  ('Pec deck (butterfly)', 'chest', '{}', 'machine', 'machine', 5, null),
  ('Pompes', 'chest', '{triceps,shoulders,abs}', 'bodyweight', 'bodyweight', 2.5, 'Corps gainé, poitrine proche du sol.'),
  ('Dips', 'chest', '{triceps,shoulders}', 'bodyweight', 'bodyweight', 2.5, 'Buste légèrement penché vers l''avant.'),
  -- Dos
  ('Tractions pronation', 'lats', '{biceps,back}', 'bodyweight', 'bodyweight', 2.5, 'Partir bras tendus, menton au-dessus de la barre.'),
  ('Tractions supination', 'lats', '{biceps}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Tirage vertical poulie haute', 'lats', '{biceps,back}', 'cable', 'machine', 5, 'Tirer vers le haut de la poitrine, buste fixe.'),
  ('Tirage horizontal poulie basse', 'back', '{lats,biceps,rear_delts}', 'cable', 'machine', 5, 'Dos droit, coudes près du corps.'),
  ('Rowing barre', 'back', '{lats,biceps,rear_delts}', 'barbell', 'free_weight', 2.5, 'Dos plat, buste incliné à 45°.'),
  ('Rowing haltère un bras', 'back', '{lats,biceps}', 'dumbbell', 'free_weight', 2, null),
  ('Rowing T-bar', 'back', '{lats,biceps}', 'barbell', 'free_weight', 2.5, null),
  ('Rowing à la machine', 'back', '{lats,biceps}', 'machine', 'machine', 5, null),
  ('Pull-over à la poulie', 'lats', '{}', 'cable', 'machine', 2.5, null),
  ('Soulevé de terre', 'lower_back', '{glutes,hamstrings,traps,quads}', 'barbell', 'free_weight', 5, 'Barre collée aux tibias, dos neutre, pousser le sol.'),
  ('Shrugs haltères', 'traps', '{}', 'dumbbell', 'free_weight', 2, null),
  ('Face pull', 'rear_delts', '{traps}', 'cable', 'machine', 2.5, 'Tirer vers le visage, coudes hauts.'),
  ('Extension lombaire', 'lower_back', '{glutes,hamstrings}', 'bodyweight', 'bodyweight', 2.5, null),
  -- Épaules
  ('Développé militaire barre', 'shoulders', '{triceps}', 'barbell', 'free_weight', 2.5, 'Fessiers et abdos serrés, pas de cambrure excessive.'),
  ('Développé épaules haltères', 'shoulders', '{triceps}', 'dumbbell', 'free_weight', 2, null),
  ('Développé épaules à la machine', 'shoulders', '{triceps}', 'machine', 'machine', 5, null),
  ('Élévations latérales haltères', 'shoulders', '{}', 'dumbbell', 'free_weight', 1, 'Monter jusqu''à l''horizontale, sans élan.'),
  ('Élévations latérales à la poulie', 'shoulders', '{}', 'cable', 'machine', 2.5, null),
  ('Élévations frontales', 'shoulders', '{}', 'dumbbell', 'free_weight', 1, null),
  ('Oiseau haltères', 'rear_delts', '{traps}', 'dumbbell', 'free_weight', 1, null),
  ('Reverse pec deck', 'rear_delts', '{traps}', 'machine', 'machine', 5, null),
  ('Rowing menton', 'shoulders', '{traps}', 'ez_bar', 'free_weight', 2.5, null),
  -- Bras
  ('Curl barre', 'biceps', '{forearms}', 'barbell', 'free_weight', 2.5, 'Coudes fixes, pas de balancier.'),
  ('Curl barre EZ', 'biceps', '{forearms}', 'ez_bar', 'free_weight', 2.5, null),
  ('Curl haltères', 'biceps', '{forearms}', 'dumbbell', 'free_weight', 1, null),
  ('Curl marteau', 'biceps', '{forearms}', 'dumbbell', 'free_weight', 1, null),
  ('Curl incliné haltères', 'biceps', '{}', 'dumbbell', 'free_weight', 1, null),
  ('Curl à la poulie', 'biceps', '{}', 'cable', 'machine', 2.5, null),
  ('Curl pupitre', 'biceps', '{}', 'ez_bar', 'free_weight', 2.5, null),
  ('Barre au front', 'triceps', '{}', 'ez_bar', 'free_weight', 2.5, 'Coudes fixes, barre vers le front.'),
  ('Extension triceps poulie haute', 'triceps', '{}', 'cable', 'machine', 2.5, null),
  ('Extension triceps nuque haltère', 'triceps', '{}', 'dumbbell', 'free_weight', 2, null),
  ('Kickback triceps', 'triceps', '{}', 'dumbbell', 'free_weight', 1, null),
  ('Développé couché prise serrée', 'triceps', '{chest,shoulders}', 'barbell', 'free_weight', 2.5, null),
  ('Dips entre deux bancs', 'triceps', '{chest}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Curl poignets', 'forearms', '{}', 'dumbbell', 'free_weight', 1, null),
  ('Farmer walk', 'forearms', '{traps,full_body}', 'dumbbell', 'free_weight', 2, 'Marcher droit, épaules basses.'),
  -- Jambes
  ('Squat barre', 'quads', '{glutes,hamstrings,lower_back}', 'barbell', 'free_weight', 5, 'Genoux dans l''axe des pieds, descendre au moins à la parallèle.'),
  ('Squat avant', 'quads', '{glutes,abs}', 'barbell', 'free_weight', 5, null),
  ('Squat au Smith machine', 'quads', '{glutes}', 'smith', 'machine', 5, null),
  ('Goblet squat', 'quads', '{glutes}', 'dumbbell', 'free_weight', 2, null),
  ('Presse à cuisses', 'quads', '{glutes,hamstrings}', 'machine', 'machine', 5, 'Ne pas décoller le bassin du dossier en bas.'),
  ('Hack squat', 'quads', '{glutes}', 'machine', 'machine', 5, null),
  ('Leg extension', 'quads', '{}', 'machine', 'machine', 5, null),
  ('Fentes avant haltères', 'quads', '{glutes}', 'dumbbell', 'free_weight', 2, null),
  ('Fentes bulgares', 'quads', '{glutes}', 'dumbbell', 'free_weight', 2, 'Pied arrière sur un banc, buste droit.'),
  ('Fentes marchées', 'quads', '{glutes}', 'dumbbell', 'free_weight', 2, null),
  ('Step-up', 'quads', '{glutes}', 'dumbbell', 'free_weight', 2, null),
  ('Soulevé de terre roumain', 'hamstrings', '{glutes,lower_back}', 'barbell', 'free_weight', 5, 'Hanches vers l''arrière, jambes quasi tendues, dos neutre.'),
  ('Good morning', 'hamstrings', '{glutes,lower_back}', 'barbell', 'free_weight', 5, null),
  ('Leg curl allongé', 'hamstrings', '{}', 'machine', 'machine', 5, null),
  ('Leg curl assis', 'hamstrings', '{}', 'machine', 'machine', 5, null),
  ('Hip thrust barre', 'glutes', '{hamstrings}', 'barbell', 'free_weight', 5, 'Menton rentré, extension complète des hanches en haut.'),
  ('Pont fessier', 'glutes', '{hamstrings}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Kickback fessier à la poulie', 'glutes', '{}', 'cable', 'machine', 2.5, null),
  ('Abduction à la machine', 'abductors', '{glutes}', 'machine', 'machine', 5, null),
  ('Adduction à la machine', 'adductors', '{}', 'machine', 'machine', 5, null),
  ('Mollets debout à la machine', 'calves', '{}', 'machine', 'machine', 5, 'Pause d''une seconde en bas, extension complète en haut.'),
  ('Mollets assis', 'calves', '{}', 'machine', 'machine', 5, null),
  ('Kettlebell swing', 'glutes', '{hamstrings,lower_back}', 'kettlebell', 'free_weight', 4, 'Mouvement de hanches, pas de squat.'),
  -- Abdominaux / gainage
  ('Gainage planche', 'abs', '{obliques,lower_back}', 'bodyweight', 'timed', 2.5, 'Corps aligné, fessiers serrés.'),
  ('Gainage latéral', 'obliques', '{abs}', 'bodyweight', 'timed', 2.5, null),
  ('Crunch', 'abs', '{}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Relevé de jambes suspendu', 'abs', '{obliques}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Crunch à la poulie', 'abs', '{}', 'cable', 'machine', 2.5, null),
  ('Russian twist', 'obliques', '{abs}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Roulette abdominale', 'abs', '{lower_back}', 'other', 'bodyweight', 2.5, null),
  ('Pallof press', 'obliques', '{abs}', 'cable', 'machine', 2.5, null),
  -- Cardio / corps entier
  ('Burpees', 'full_body', '{chest,quads}', 'bodyweight', 'bodyweight', 2.5, null),
  ('Rameur', 'cardio', '{back,quads}', 'cardio_machine', 'cardio', 1, null),
  ('Vélo', 'cardio', '{quads}', 'cardio_machine', 'cardio', 1, null),
  ('Tapis de course', 'cardio', '{}', 'cardio_machine', 'cardio', 1, null),
  ('Corde à sauter', 'cardio', '{calves}', 'other', 'timed', 1, null)
on conflict do nothing;

-- Alternatives (machine prise, etc.) — dans les deux sens.
with pairs(a, b) as (
  values
    ('Développé couché barre', 'Développé couché haltères'),
    ('Développé couché barre', 'Développé couché à la machine'),
    ('Développé incliné barre', 'Développé incliné haltères'),
    ('Pec deck (butterfly)', 'Écarté à la poulie vis-à-vis'),
    ('Pec deck (butterfly)', 'Écarté haltères'),
    ('Tirage vertical poulie haute', 'Tractions pronation'),
    ('Tirage horizontal poulie basse', 'Rowing à la machine'),
    ('Tirage horizontal poulie basse', 'Rowing haltère un bras'),
    ('Rowing barre', 'Rowing T-bar'),
    ('Squat barre', 'Presse à cuisses'),
    ('Squat barre', 'Hack squat'),
    ('Squat barre', 'Squat au Smith machine'),
    ('Presse à cuisses', 'Hack squat'),
    ('Leg curl allongé', 'Leg curl assis'),
    ('Soulevé de terre roumain', 'Good morning'),
    ('Hip thrust barre', 'Pont fessier'),
    ('Développé militaire barre', 'Développé épaules haltères'),
    ('Développé militaire barre', 'Développé épaules à la machine'),
    ('Élévations latérales haltères', 'Élévations latérales à la poulie'),
    ('Reverse pec deck', 'Oiseau haltères'),
    ('Reverse pec deck', 'Face pull'),
    ('Extension triceps poulie haute', 'Barre au front'),
    ('Curl barre', 'Curl barre EZ'),
    ('Curl haltères', 'Curl à la poulie'),
    ('Mollets debout à la machine', 'Mollets assis'),
    ('Fentes bulgares', 'Fentes avant haltères'),
    ('Rameur', 'Vélo')
)
insert into public.exercise_alternatives (exercise_id, alternative_id)
select e1.id, e2.id from pairs p
join public.exercises e1 on e1.name = p.a
join public.exercises e2 on e2.name = p.b
union
select e2.id, e1.id from pairs p
join public.exercises e1 on e1.name = p.a
join public.exercises e2 on e2.name = p.b
on conflict do nothing;
