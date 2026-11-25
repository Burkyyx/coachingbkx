# CLAUDE.md — Conventions du projet « Divus » (coaching sportif)

Référence fonctionnelle : la spécification fournie par Enzo (coach, non développeur). Résumé :
1 coach unique, des adhérents sur invitation, programmes d'entraînement, mode séance hors-ligne,
suggestions automatiques **validées par le coach**. Phases : 1 (entraînement, MVP) → 2 (nutrition)
→ 3 (communauté). **Ne jamais commencer une phase sans validation d'Enzo.**

## Règles de travail

- **Toujours écrire à Enzo en français** (messages, explications, questions, étapes), sans exception.
- Interface **100 % en français**, ton tutoiement côté adhérent. Textes dans `src/i18n/locales/fr.ts`
  (clés typées : `t('cle.inexistante')` ne compile pas).
- Commits **en français**, un commit par fonctionnalité.
- Pas de fonctionnalité hors spec sans demander. Choix technique non couvert → demander.
- Unités : kg, cm, kcal, g. Séparateur décimal affiché : virgule.
- Principe central : **l'algorithme propose, le coach décide** (sauf règle en « application auto »).

## Stack

- Expo **SDK 58** (React Native 0.88, React 19.3), TypeScript **strict** (+ `noUncheckedIndexedAccess`).
- expo-router : les routes sont dans **`src/app/`** (pas `app/`). Groupes : `(auth)`, `(coach)`, `(adherent)`.
- Supabase (Postgres + RLS, Auth, Storage, Edge Functions, Realtime) — région UE.
- TanStack Query (données serveur), Zustand (état local), react-hook-form + zod **v4**.
- Graphiques : react-native-gifted-charts (SVG, iOS/Android/Web).
- Hors-ligne : `src/offline/` — expo-sqlite sur mobile, IndexedDB/localStorage sur web
  (fichiers `.native.ts` / `.web.ts`), file d'attente (outbox) + identifiants UUID générés côté client.

## Arborescence

- `src/app/` écrans (routes). Pas de logique métier lourde ici.
- `src/core/` **TypeScript pur** (aucun import React/Expo/Supabase) : algorithmes de suggestion,
  métriques (1RM Epley, volume, records, assiduité, tendance de poids), schémas zod partagés.
  Tout y est testé unitairement. Ce code est aussi utilisé par les Edge Functions.
- `src/features/<domaine>/` hooks TanStack Query + composants propres au domaine.
- `src/components/ui/` composants génériques (Button, Card, TextField, Stepper, États…).
- `src/theme/tokens.ts` **thème centralisé** (couleurs, espacements, typo). Ne pas coder de couleurs en dur.
- `src/lib/` client Supabase, types générés (`database.types.ts`), utilitaires.
- `supabase/migrations/` migrations SQL versionnées (jamais modifier une migration déjà appliquée
  en production : en ajouter une nouvelle). `supabase/tests/` tests pgTAP des politiques RLS.
- `supabase/functions/` Edge Functions (Deno).

## Sécurité (non négociable)

- **RLS activée sur toutes les tables**, chaque politique testée dans `supabase/tests/`.
- Fonction SQL `public.is_coach()` = accès coach. Adhérent = uniquement ses lignes (`adherent_id = auth.uid()`).
- Notes privées du coach dans une table séparée (`coach_notes`), jamais lisibles par l'adhérent.
- Buckets Storage **privés**, accès par URL signées. Aucune clé secrète dans l'app (`EXPO_PUBLIC_*` = public).
- Logs sans données personnelles.

## Commandes

- `npm run web` — lancer l'app dans le navigateur.
- `npm run check` — typecheck + lint + tests Jest (à lancer avant chaque commit).
- `npm run test:rls` — tests pgTAP des politiques RLS (Docker requis).
- `npm run db:start` / `db:reset` / `db:types` — Supabase local.

## Pièges connus

- La doc en ligne Expo n'est pas toujours accessible depuis l'environnement cloud : se fier aux
  types installés dans `node_modules`. `npx expo install` peut échouer (réseau) : prendre les versions
  dans `node_modules/expo/bundledNativeModules.json` et installer avec `npm install pkg@version`.
- @testing-library/react-native **v14** : `render`, `fireEvent` sont **asynchrones** (`await`).
- zod v4 : `z.email()`, `z.uuid()` ; messages via `{ error: '...' }`.
- Expo Router : `web.output = 'single'` (SPA) pour l'hébergement statique Cloudflare Pages.
- Environnement cloud : le serveur Metro ne voit pas toujours les modifications de fichiers
  (cache périmé, types de routes non régénérés). Relancer `npx expo start --web --clear`.
- Supabase local dans l'environnement cloud : `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start
-x studio,imgproxy,vector,logflare,supavisor,postgres-meta,mailpit` (Docker : lancer `dockerd` d'abord).

## État d'avancement

- **Phase 1 validée par Enzo** (nov. 2026). **Phase 2 (nutrition) : validée, en cadrage.** Phase 3 (communauté) : NON commencée.
- Phase 2 — décisions : analyse photo avec **Claude Haiku 5.5** (`claude-haiku-5-5`, modèle réglable par variable
  d'environnement de l'Edge Function) ; code-barres **caméra + saisie manuelle** (Open Food Facts) ; compte
  Anthropic créé plus tard par Enzo. Objectifs : calcul **DEJ = métabolisme de base × NAP** (sexe, taille, poids,
  âge, activité), ajustable par le coach :
  - MB : **Mifflin-St Jeor** (H : 10P + 6,25T − 5A + 5 ; F : … − 161) ;
  - NAP **hors sport** selon `activity_level` (1,4 · 1,5 · 1,6 · 1,75 · 1,9) **+ dépense nette des séances du
    programme** (MET × poids × durée, lissée sur la semaine) ;
  - plancher = **MB** (jamais < 1 200 kcal) ; perte limitée à 1 %/semaine ;
  - objectif : sèche DEJ − 15 %, prise de masse + 10 %, sinon = DEJ ; protéines 1,8 g/kg (2 g/kg en sèche),
    lipides 1 g/kg, glucides = le reste. Tout reste modifiable par adhérent.
- Nom de l'app : **« Divus »** (anciennement « Élan », renommée en nov. 2026), thème noir & blanc (`src/theme/tokens.ts`).
  Identifiants techniques gardés volontairement avec « elan » (renommer = perte de données) :
  `supabase/config.toml` project_id (base locale), préfixe `elan:` (stockage web) et `elan.db` (SQLite).

## Décisions validées avec Enzo (Phase 1)

- Web d'abord ; connexion e-mail + Google + Apple ; inscription sur invitation (code 8 caractères, 7 jours, usage unique).
- Programmes : semaines distinctes, jour fixé par le coach ; pas de séance libre hors programme.
- % du 1RM : 1RM de référence saisi par le coach (`reference_1rm`), repli sur la dernière perf.
- Repos réel : du « Valider » au « Je reprends » (ou à la validation suivante).
- Échelle d'effort RIR/RPE réglée par adhérent. Vidéos messagerie : 60 s / 50 Mo.
- Consentements demandés à l'arrivée de la fonctionnalité (CGU + entraînement à l'inscription,
  données corporelles au 1er bilan). Pas de mineurs < 15 ans (blocage).
- Suppression de compte immédiate et définitive. Hébergement web : Cloudflare Pages. E-mails : Brevo.
- En ligne : site https://divuscoaching.pages.dev (Cloudflare Pages, branche `claude/spec-md-instructions-14v2w9`),
  Supabase projet « ElanBKX » (ref `lzjcowifdikadgaiurfk`, Irlande). CLI : `db push --remote` pour la prod.
- Retours de test (nov. 2026) : niveau d'activité au quotidien (5 niveaux, `profiles.activity_level`,
  demandé à l'inscription et aux anciens adhérents) ; pas de banque d'images automatique (photos du coach
  + miniatures YouTube) ; tableau de bord = chiffres de la semaine + assiduité 8 semaines ; schéma du
  corps cliquable (coach + catalogue adhérent en consultation, sans séance libre).

## Points techniques

- Suggestions : `src/core/algorithms` (pur, testé) → copie dans `supabase/functions/_shared/core`
  (`npm run core:sync`, vérifiée en CI). Edge Function `compute-suggestions` (logique dans `analyze.ts`,
  testable avec Node) déclenchée par l'app après synchro + tâche planifiée.
- Hors-ligne : écritures via `saveOffline()` (`src/offline/sync.ts`) ; identifiants stables pour bilans/pesées
  (`stableUuid`). Séance en cours persistée (`src/features/training/session/store.ts`).
- Données de démo : `npm run seed:demo` (Node exécute directement le TypeScript).
- Environnement cloud : le runtime local des Edge Functions ne peut pas télécharger ses dépendances
  (proxy) → tester `analyze.ts` avec Node contre la base locale.
