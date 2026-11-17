-- =============================================================================
-- Tâches planifiées (À EXÉCUTER UNE FOIS par projet, dans Supabase > SQL Editor,
-- après `npx supabase db push` et `npx supabase functions deploy`).
--
-- Avant : Database > Extensions > activer « pg_cron » et « pg_net »
-- (sinon erreur « schema "cron" does not exist »).
--
-- Remplacer (2 fois chacun) :
--   <PROJECT_REF>  : identifiant du projet (dans l'URL https://<PROJECT_REF>.supabase.co)
--   <CRON_SECRET>  : la même valeur que le secret CRON_SECRET des fonctions
--
-- Le script peut être relancé sans risque : une tâche du même nom est mise à jour.
-- =============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Rappels et alertes (séance manquée, inactivité, bilan…) : toutes les heures.
-- Normalement créée par les migrations ; recréée ici si pg_cron n'était pas actif.
select cron.schedule('run-hourly-jobs', '5 * * * *', 'select public.run_hourly_jobs()');

-- Analyse des séances terminées (suggestions + alertes) toutes les 10 minutes
-- (l'app la déclenche aussi juste après la synchronisation d'une séance).
select cron.schedule(
  'compute-suggestions',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/compute-suggestions',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Envoi des notifications push toutes les minutes.
select cron.schedule(
  'send-push',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Vérification (3 lignes attendues) : select jobname, schedule from cron.job;
