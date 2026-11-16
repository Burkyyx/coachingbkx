-- =============================================================================
-- Tâches planifiées appelant les Edge Functions (À EXÉCUTER UNE FOIS par projet,
-- dans Supabase > SQL Editor, après `npx supabase functions deploy`).
--
-- Remplacer :
--   <PROJECT_REF>  : identifiant du projet (dans l'URL https://<PROJECT_REF>.supabase.co)
--   <CRON_SECRET>  : la même valeur que le secret CRON_SECRET des fonctions
-- =============================================================================
create extension if not exists pg_net;

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

-- Vérification : select jobname, schedule from cron.job;
