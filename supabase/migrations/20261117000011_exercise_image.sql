-- =============================================================================
-- 0011 — Image de l'exercice (photo ou schéma), stockée dans le bucket privé
-- « exercise-media », en complément de la vidéo (fichier ou lien YouTube).
-- =============================================================================
alter table public.exercises add column if not exists image_path text;

comment on column public.exercises.image_path is
  'Image de l''exercice dans le bucket privé exercise-media (accès par lien signé).';
