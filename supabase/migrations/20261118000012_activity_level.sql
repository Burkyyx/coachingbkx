-- Niveau d'activité physique de base (hors séances de sport).
-- Sert au coach pour adapter le programme, et en Phase 2 au calcul des besoins caloriques.
create type public.activity_level as enum (
  'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'
);

alter table public.profiles add column if not exists activity_level public.activity_level;

comment on column public.profiles.activity_level is
  'Activité au quotidien hors sport, déclarée par l''adhérent (5 niveaux).';
