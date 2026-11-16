-- =============================================================================
-- 0008 — Durcissement : par défaut, Supabase autorise les visiteurs anonymes à
-- exécuter les fonctions du schéma public. On retire ce droit partout, sauf pour
-- la vérification d'un code d'invitation (nécessaire avant la création du compte).
-- =============================================================================
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;
grant execute on function public.check_invitation(text) to anon;
