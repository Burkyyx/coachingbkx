-- -----------------------------------------------------------------------------
-- Phase 2 (étape 5) : nouveaux types (migration séparée : une valeur ajoutée à un
-- type énuméré n'est utilisable qu'après la validation de la transaction).
-- -----------------------------------------------------------------------------
alter type public.suggestion_kind add value if not exists 'calories';   -- ajuster l'objectif calorique
alter type public.alert_type add value if not exists 'deficit_performance'; -- déficit + force en baisse
