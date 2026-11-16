-- =============================================================================
-- 0007 — Tâches planifiées (pg_cron)
-- =============================================================================
-- Rappels et alertes : toutes les heures, à la minute 5.
-- Les tâches qui appellent des Edge Functions (analyse des séances, envoi des push)
-- sont configurées séparément (voir supabase/setup/cron_edge_functions.sql et README),
-- car elles nécessitent l'URL du projet et un secret.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('run-hourly-jobs', '5 * * * *', 'select public.run_hourly_jobs()');
exception when others then
  raise notice 'pg_cron indisponible ici (%). Planification ignorée.', sqlerrm;
end;
$$;
