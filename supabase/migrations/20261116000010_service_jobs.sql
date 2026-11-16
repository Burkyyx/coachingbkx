-- =============================================================================
-- 0010 — Les tâches serveur (clé service_role : Edge Functions, scripts) peuvent
-- lancer la tâche horaire (rappels et alertes). Jamais accessible depuis l'app.
-- =============================================================================
grant execute on function public.run_hourly_jobs(timestamptz) to service_role;
