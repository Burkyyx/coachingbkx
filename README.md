# Divus — application de coaching sportif

> Nom provisoire (modifiable dans `app.config.ts` et `src/i18n/locales/fr.ts`).
> Application **iOS · Android · Web** pour le coaching d'Enzo : programmes d'entraînement,
> mode séance utilisable **sans réseau**, suggestions de progression **validées par le coach**,
> bilans hebdomadaires, messagerie et notifications.

Ce guide est écrit pour quelqu'un qui n'est pas développeur. Suis les étapes dans l'ordre.

---

## Sommaire

1. [Ce que contient le projet](#1-ce-que-contient-le-projet)
2. [Installer les outils sur ton Mac](#2-installer-les-outils-sur-ton-mac)
3. [Lancer l'app en local (sur ton ordinateur)](#3-lancer-lapp-en-local)
4. [Tester la Phase 1 pas à pas](#4-tester-la-phase-1-pas-à-pas)
5. [Créer le projet Supabase en ligne (UE)](#5-créer-le-projet-supabase-en-ligne)
6. [Connexion Google et Apple](#6-connexion-google-et-apple)
7. [Mettre le site web en ligne (Cloudflare Pages)](#7-mettre-le-site-web-en-ligne)
8. [Installer l'app sur ton iPhone / Android (EAS)](#8-installer-lapp-sur-ton-téléphone-eas)
9. [Publier sur l'App Store et Google Play](#9-publier-sur-les-stores)
10. [Sauvegardes de la base](#10-sauvegardes)
11. [Commandes utiles et dépannage](#11-commandes-utiles-et-dépannage)

---

## 1. Ce que contient le projet

| Dossier                  | Contenu                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`               | Les écrans (un fichier = un écran). `coach/` : espace coach ; `(adherent)/` : espace adhérent ; `(auth)/` et `setup/` : connexion et inscription. |
| `src/core/`              | **Les algorithmes** (progression, stagnation, fatigue, records, tendance de poids…), en TypeScript pur, testés automatiquement.                   |
| `src/features/`          | Le code de chaque fonctionnalité (programmes, séance, messagerie…).                                                                               |
| `src/offline/`           | Le **hors-ligne** : stockage sur l'appareil et file d'attente de synchronisation.                                                                 |
| `src/theme/tokens.ts`    | **Les couleurs et tailles** de l'app (un seul fichier pour tout changer).                                                                         |
| `src/i18n/locales/fr.ts` | **Tous les textes** de l'app.                                                                                                                     |
| `src/legal/documents.ts` | Mentions légales, CGU, confidentialité — **à compléter** (`[À COMPLÉTER]`) et faire relire.                                                       |
| `supabase/migrations/`   | La structure de la base de données et ses règles de sécurité.                                                                                     |
| `supabase/tests/`        | 121 tests de sécurité (un adhérent ne peut jamais voir les données d'un autre).                                                                   |
| `supabase/functions/`    | Les fonctions serveur : analyse des séances, notifications push, suppression de compte.                                                           |
| `scripts/seed-demo.ts`   | Création de données de démonstration (1 coach, 5 adhérents, 2 mois).                                                                              |

**Comptes de démonstration** (après `npm run seed:demo`, mot de passe `motdepasse123`) :
`coach@demo.fr` (coach), `julie@demo.fr`, `thomas@demo.fr`, `sarah@demo.fr`, `karim@demo.fr`, `lea@demo.fr`.

---

## 2. Installer les outils sur ton Mac

À faire une seule fois.

1. **Node.js 22** : https://nodejs.org → télécharger la version « LTS » → installer.
2. **Docker Desktop** : https://www.docker.com/products/docker-desktop → installer puis **lancer** l'application
   (l'icône de baleine doit apparaître en haut de l'écran). Docker fait tourner Supabase sur ton Mac.
3. **Homebrew** (gestionnaire d'outils) : ouvrir l'app _Terminal_ et coller la commande donnée sur https://brew.sh
4. **psql** (pour les tests de sécurité) : dans le Terminal, `brew install libpq && brew link --force libpq`
5. **Le projet** : dans le Terminal,
   ```bash
   git clone https://github.com/burkyyx/coachingbkx.git
   cd coachingbkx
   git checkout claude/spec-md-instructions-14v2w9
   npm install
   ```
   > Le code de la Phase 1 se trouve pour l'instant sur la branche `claude/spec-md-instructions-14v2w9`
   > (la branche `main` ne contient que le fichier de départ). Une fois la Phase 1 validée et fusionnée
   > dans `main`, la ligne `git checkout …` ne sera plus nécessaire.

> Sur Windows : mêmes outils (Node.js, Docker Desktop) ; utiliser PowerShell. `psql` s'installe avec
> PostgreSQL (https://www.postgresql.org/download/windows/).

---

## 3. Lancer l'app en local

Dans le Terminal, depuis le dossier `coachingbkx` :

```bash
# 1. Démarrer Supabase (base de données, connexion, stockage…) — 1re fois : quelques minutes
npm run db:start
```

À la fin, la commande affiche des informations. Repère **API URL** et **anon key** (ou « Publishable key »).

```bash
# 2. Créer ton fichier de configuration
cp .env.example .env.local
```

Ouvre `.env.local` avec TextEdit et colle l'URL (`http://127.0.0.1:54321`) et la clé **anon**.

```bash
# 3. Créer les données de démo (remplace XXX par la « service_role key » / « Secret key » affichée par db:start)
SUPABASE_SERVICE_ROLE_KEY=XXX npm run seed:demo

# 4. Lancer l'app dans le navigateur
npm run web
```

L'app s'ouvre sur http://localhost:8081 (≈ 1 min au démarrage). Connecte-toi avec `coach@demo.fr` /
`motdepasse123`. Le Terminal affiche aussi un code QR pour l'ouvrir sur ton téléphone (voir ci-dessous).

**Créer TON compte coach** (au lieu du compte de démo) : ouvre http://127.0.0.1:54323 (Supabase Studio),
_Authentication → Add user_ (ton e-mail + mot de passe, coche « Auto confirm »), puis _SQL Editor_ :

```sql
select public.bootstrap_coach('ton-email@exemple.fr');
```

> Il ne peut y avoir qu'**un seul** coach. Si tu as lancé la démo, supprime d'abord le compte `coach@demo.fr`
> dans _Authentication_, puis relance la commande ci-dessus.

### Ouvrir l'app sur ton téléphone (même Wi-Fi que le Mac)

1. Supabase doit tourner (`npm run db:start`).
2. Lance l'app comme d'habitude :
   ```bash
   npm run web
   ```
   (`npm run phone` fait exactement la même chose ; si l'app tourne déjà dans une autre fenêtre,
   il affiche juste le code QR.)
3. Attends le cadre **« 📱 SUR TON TÉLÉPHONE »** avec un code QR (≈ 1 min la 1re fois).
   **Scanne CE code** avec l'appareil photo du téléphone (ou tape l'adresse affichée,
   ex. `http://192.168.1.20:8081`, dans Safari / Chrome).
   _Ignore l'autre code QR affiché plus haut par Expo : il sert à une version de développement
   de l'app, pas au navigateur._
4. Si le Mac demande d'**autoriser les connexions entrantes** (pour « node » ou Docker) : _Autoriser_.

Sous le code QR, deux lignes de vérification : **✓ App joignable** et **✓ Base de données joignable**.
Un **✗** indique ce qui bloque (ex. Supabase arrêté → `npm run db:start`).

Ça ne marche pas ?

- Le téléphone doit être sur le **même Wi-Fi** que le Mac (pas en 4G/5G, pas sur un Wi-Fi « invités »).
- Si le cadre propose d'autres adresses (« essaie plutôt »), tape-les dans le navigateur du téléphone.
- La page ne s'ouvre pas : _Réglages Système → Réseau → Coupe-feu_ du Mac → désactive-le le temps
  du test, ou autorise « node ».
- Le mode avion (hors-ligne) ne se teste qu'avec la version en ligne (https, [section 7](#7-mettre-le-site-web-en-ligne)) :
  sur une adresse `http://192.168…` le navigateur du téléphone ne met pas l'app en cache.

Pour l'app native (App Store / Play Store), voir la [section 8](#8-installer-lapp-sur-ton-téléphone-eas).

---

## 4. Tester la Phase 1 pas à pas

Les 4 critères d'acceptation de la Phase 1 :

### ✅ 1. « Je crée un programme sur ordinateur, je l'assigne, l'adhérent le reçoit sur son téléphone »

1. Sur l'ordinateur, connecté en coach : **Programmes → Nouveau modèle**.
2. Renomme-le, **Ajouter une séance**, choisis le jour (ex. aujourd'hui), **Ajouter un exercice**,
   règle les séries (reps, charge, RIR, repos). Raccourcis : `N` nouvelle séance, `S` nouvelle semaine, `?` aide.
3. **Assigner** → coche un adhérent → date de début = aujourd'hui (JJ/MM/AAAA) → **Assigner**.
4. Sur le téléphone (navigateur), connecte-toi avec l'adhérent : la séance apparaît dans **Aujourd'hui**
   et l'adhérent reçoit une notification (cloche).

### ✅ 2. « L'adhérent fait une séance en mode avion, la synchro se fait au retour du réseau »

1. Sur le téléphone, ouvre l'app **une première fois avec le réseau** (elle se met en cache).
2. Active le **mode avion**. Appuie sur **Commencer la séance**.
3. Pour chaque série : ajuste charge/reps avec − / +, touche ton RIR, **Valider la série** →
   le minuteur de repos démarre (+30 s / −15 s / **Je reprends**).
4. **Terminer** → ressenti 1–10 → **Enregistrer la séance**. Le badge **« Non synchronisé »** s'affiche.
5. Coupe le mode avion : en 1 à 2 secondes le badge disparaît.
6. Sur l'ordinateur : **Adhérents → (l'adhérent) → Séances** → ouvre la séance : chaque série avec
   charge, reps, RIR et **repos réel vs prescrit**.

> Astuce : ferme l'app en pleine séance et rouvre-la → **Reprendre la séance** (rien n'est perdu).

### ✅ 3. « Un adhérent ne peut jamais lire les données d'un autre »

```bash
npm run test:rls
```

Résultat attendu : `✅ 121 tests RLS réussis.` (Docker doit être lancé). Ces tests sont aussi
exécutés automatiquement sur GitHub à chaque modification.

### ✅ 4. « Les suggestions apparaissent et je peux les accepter / modifier / refuser »

Avec les données de démo : **Suggestions** (badge dans le menu). Chaque suggestion a une justification
(ex. « Dernière séance à 15 reps ou plus sur toutes les séries… → +5 kg proposé »).
**Accepter** applique la nouvelle charge aux séances à venir, **Modifier** permet de choisir ta valeur,
**Refuser** l'écarte. Onglet **Historique** : **Annuler** remet les valeurs d'origine.
Les règles se règlent dans **Réglages** (global), dans la fiche adhérent (pour lui) et dans la fiche
d'un exercice.

### Autres points à vérifier

- Inscription : **Invitations → Créer une invitation → Copier le lien** → ouvrir le lien dans une fenêtre
  privée → créer un compte → consentements → profil.
- Bilan hebdo (adhérent) : **Aujourd'hui → Remplir mon bilan** ; réponse du coach dans la fiche → onglet **Bilans**.
- Messagerie temps réel : ouvre la conversation des deux côtés, les messages arrivent instantanément.
- Profil adhérent : pesées, records, notifications, consentements, **export** (JSON + CSV), suppression du compte.

---

## 5. Créer le projet Supabase en ligne

1. Crée un compte sur https://supabase.com → **New project** :
   - Région : **West EU (Paris)** (`eu-west-3`) — données hébergées dans l'UE ;
   - Mot de passe de base de données : génère-le et **garde-le** (gestionnaire de mots de passe).
   - Plan : gratuit pour commencer. ⚠️ Le plan gratuit **met le projet en pause après 7 jours sans
     activité** et n'a pas de sauvegardes : passe au plan **Pro** avant d'inviter tes adhérents.
2. Dans le Terminal :
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>     # visible dans l'URL du projet
   npx supabase db push --remote                     # crée toutes les tables et règles de sécurité
   npx supabase migration list --remote              # vérification : 18 migrations dans « Remote »
   ```
   ⚠️ Sans `--remote`, ces commandes visent la base **locale** de ton Mac (le terminal l'indique :
   « Target: local stack »). À chaque nouvelle migration, refais `npx supabase db push --remote`.
3. **Secrets des fonctions serveur** (invente une longue phrase pour CRON_SECRET) :
   ```bash
   npx supabase secrets set CRON_SECRET="une-longue-phrase-secrete"
   npx supabase functions deploy compute-suggestions
   npx supabase functions deploy send-push
   npx supabase functions deploy delete-account
   npx supabase functions deploy analyze-meal
   ```
   **Analyse des photos de repas (Phase 2)** : tant qu'aucune clé n'est enregistrée, l'app propose
   la saisie manuelle à la place. Pour l'activer, crée une clé sur https://console.anthropic.com
   (_API Keys_), puis :
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY="sk-ant-..."
   # facultatif : autre modèle que Claude Haiku 5.5
   npx supabase secrets set ANTHROPIC_MODEL="claude-haiku-5-5"
   ```
   La clé reste sur le serveur Supabase : elle n'est jamais dans l'app. Coût indicatif : moins
   d'un dixième de centime par photo ; le nombre d'analyses par jour et par adhérent se règle
   dans l'onglet Nutrition de chaque adhérent (10 par défaut), et chaque analyse est notée dans
   la table `ai_usage`.
4. **Tâches planifiées** :
   - dans Supabase, _Database → Extensions_ : active **pg_cron** et **pg_net** (sinon erreur
     « schema "cron" does not exist ») ;
   - ouvre le fichier `supabase/setup/cron_edge_functions.sql` (`open -e supabase/setup/cron_edge_functions.sql`),
     copie tout, colle-le dans _SQL Editor → New query_ ;
   - remplace `<PROJECT_REF>` (identifiant du projet, dans l'adresse de la page) et `<CRON_SECRET>`
     (la phrase de l'étape 3) — 2 fois chacun — puis _Run_ ;
   - vérification : `select jobname, schedule from cron.job;` doit afficher **3 lignes**.
5. **E-mails** (confirmation, mot de passe oublié) : le service intégré de Supabase est limité à quelques
   e-mails par heure. Crée un compte **Brevo** (https://www.brevo.com, gratuit), puis dans Supabase
   _Authentication → Emails → SMTP Settings_ : hôte `smtp-relay.brevo.com`, port `587`, identifiants Brevo.
   Active aussi _Confirm email_. Les modèles d'e-mails se traduisent dans _Email Templates_.
6. _Authentication → URL Configuration_ : **Site URL** = l'adresse de ton site web (section 7) ;
   ajoute aussi `divus://**` dans _Redirect URLs_ (pour l'app mobile).
7. Crée ton compte coach (_Authentication → Add user_) puis dans _SQL Editor_ :
   `select public.bootstrap_coach('ton-email@exemple.fr');`
8. Dans `.env.local` (et dans Cloudflare / EAS, sections 7–8) : `EXPO_PUBLIC_SUPABASE_URL` et
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` du projet en ligne (_Project Settings → API_).

> **Ne mets jamais** la clé `service_role` / « Secret key » dans l'app ni dans `.env.local` :
> elle donne un accès total à la base.

---

## 6. Connexion Google et Apple

L'inscription reste **sur invitation** : la personne saisit d'abord son code, puis choisit
e-mail, Google ou Apple.

- **Google** (gratuit) : https://console.cloud.google.com → nouveau projet → _APIs & Services →
  Credentials → Create OAuth client ID_ (type _Web application_). URI de redirection autorisée :
  `https://<PROJECT_REF>.supabase.co/auth/v1/callback`. Copie l'ID et le secret dans Supabase
  _Authentication → Providers → Google_. Puis `EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=true`.
- **Apple** : nécessite le **compte Apple Developer (99 €/an)**. Suivre le guide Supabase
  « Login with Apple » (Service ID + clé), renseigner _Authentication → Providers → Apple_, puis
  `EXPO_PUBLIC_ENABLE_APPLE_AUTH=true`. Apple impose ce bouton dès qu'un autre fournisseur (Google)
  est proposé dans l'app iOS.

---

## 7. Mettre le site web en ligne

On utilise **Cloudflare Pages** (gratuit, usage commercial autorisé — l'offre gratuite de Vercel,
elle, est réservée à un usage non commercial).

1. Crée un compte https://dash.cloudflare.com → _Workers & Pages → Create → Pages → Connect to Git_ →
   choisis le dépôt `coachingbkx`.
2. Réglages de construction :
   - Build command : `npm run build:web`
   - Build output directory : `dist`
   - Variables d'environnement : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
     `EXPO_PUBLIC_WEB_URL` (l'adresse finale, ex. `https://divuscoaching.pages.dev`), `NODE_VERSION=22`.
3. Ton site est disponible sur `https://<nom>.pages.dev` (nom de domaine personnalisé possible plus tard).
4. Reporte cette adresse dans Supabase (_URL Configuration → Site URL_).

**Mises à jour automatiques** : chaque modification poussée sur la branche est reconstruite et mise en
ligne par Cloudflare en 3 à 5 minutes. Si aucun nouveau déploiement n'apparaît :

- message « This project is disconnected from your Git account » : sur GitHub, _Settings → Applications →
  Installed GitHub Apps → Cloudflare Workers and Pages → Configure_ → donner accès au dépôt `coachingbkx` ;
- _Settings → Builds → Branch control_ : branche de production `claude/spec-md-instructions-14v2w9` et
  déploiements automatiques activés ;
- « Retry deployment » reconstruit l'**ancien** commit : pour prendre les dernières modifications, il faut
  un nouveau commit sur la branche.

Le site fonctionne **hors-ligne** une fois ouvert une première fois (service worker), et peut être
ajouté à l'écran d'accueil du téléphone (_Partager → Sur l'écran d'accueil_ sur iPhone).

---

## 8. Installer l'app sur ton téléphone (EAS)

Pour les notifications push et l'alerte du minuteur en arrière-plan, il faut une **version installée**
(pas le navigateur, pas Expo Go).

1. Crée un compte https://expo.dev, puis :
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init        # crée le projet EAS (note l'ID affiché)
   ```
   Ajoute `EAS_PROJECT_ID=<l'ID>` dans tes variables EAS (_expo.dev → projet → Environment variables_),
   ainsi que les variables `EXPO_PUBLIC_…`.
2. **Android** (aucun compte payant requis pour tester) :
   ```bash
   npx eas-cli@latest build --profile preview --platform android
   ```
   Ouvre le lien reçu sur le téléphone Android pour installer l'app.
3. **iPhone** : nécessite le **compte Apple Developer (99 €/an)**.
   ```bash
   npx eas-cli@latest device:create            # enregistre ton iPhone (scanne le QR code)
   npx eas-cli@latest build --profile preview --platform ios
   ```
   Ouvre le lien sur l'iPhone et installe l'app (_Réglages → Général → VPN et gestion de l'appareil_
   pour faire confiance au développeur si demandé).
4. Pour le développement (rechargement instantané), utilise `--profile development` puis `npm start`.

---

## 9. Publier sur les stores

**Comptes nécessaires** : Apple Developer (99 €/an) et Google Play Console (25 $, une seule fois).

1. Construire les versions de production :
   ```bash
   npx eas-cli@latest build --profile production --platform all
   ```
2. Envoyer aux stores :
   ```bash
   npx eas-cli@latest submit --platform ios       # vers App Store Connect / TestFlight
   npx eas-cli@latest submit --platform android   # vers Google Play (piste interne d'abord)
   ```
3. **À préparer** dans App Store Connect et la Play Console :
   - icône 1024×1024 et icône définitive (remplacer les images dans `assets/`) ;
   - captures d'écran : iPhone 6,7" et 6,5", iPad si activé, téléphone Android ;
   - description, mots-clés, catégorie « Santé et forme » ;
   - **URL de la politique de confidentialité** (page `/legal/privacy` du site web) ;
   - **Déclarations de confidentialité** (« App Privacy » chez Apple, « Data safety » chez Google) :
     données collectées = nom, e-mail, données de santé et de forme (séances, poids), photos, messages ;
     finalité = fonctionnement de l'app ; **pas de suivi publicitaire**, pas de partage avec des tiers ;
     données liées à l'identité ; suppression possible dans l'app (_Profil → Supprimer mon compte_) ;
   - un **compte de démonstration** pour les testeurs Apple/Google (un adhérent invité exprès).
4. L'app est gratuite, sans achat intégré ni publicité.

---

## 10. Sauvegardes

- **Plan Pro Supabase** : sauvegarde automatique quotidienne (7 jours conservés). Option
  _Point-in-Time Recovery_ pour revenir à une minute précise.
- **Sauvegarde manuelle** (conseillée chaque mois, à garder dans un endroit sûr) :
  ```bash
  npx supabase db dump --linked -f sauvegarde-$(date +%Y-%m-%d).sql
  npx supabase db dump --linked --data-only -f donnees-$(date +%Y-%m-%d).sql
  ```
- Les fichiers (photos, vidéos) sont dans _Storage_ ; ils peuvent être téléchargés depuis le tableau
  de bord Supabase.

---

## 11. Commandes utiles et dépannage

| Commande                       | À quoi ça sert                                                           |
| ------------------------------ | ------------------------------------------------------------------------ |
| `npm run web`                  | Lancer l’app (navigateur du Mac + code QR pour le téléphone)             |
| `npm run phone`                | Idem ; si l’app tourne déjà, affiche seulement le code QR                |
| `npm start`                    | Serveur pour la version de développement native (section 8)              |
| `npm run check`                | Vérifier tout le code (types, style, tests)                              |
| `npm run test:rls`             | Tests de sécurité de la base (Docker requis)                             |
| `npm run test:coverage`        | Tests + couverture des algorithmes                                       |
| `npm run db:start` / `db:stop` | Démarrer / arrêter Supabase en local                                     |
| `npm run db:reset`             | Remettre la base locale à zéro (⚠️ efface les données locales)           |
| `npm run seed:demo`            | Données de démonstration (local uniquement)                              |
| `npm run build:web`            | Construire le site web (dossier `dist/`)                                 |
| `npm run core:sync`            | Copier les algorithmes vers les fonctions serveur après une modification |

**Problèmes fréquents**

- _« Configuration manquante »_ au lancement : le fichier `.env.local` n'existe pas ou est incomplet.
- _Une modification n'apparaît pas_ : arrête (`Ctrl + C`) et relance avec `npx expo start --web --clear`.
- _`db:start` échoue_ : vérifie que Docker Desktop est lancé.
- _Pas de suggestions_ : elles sont calculées après chaque séance terminée (et toutes les 10 min en ligne).
  Bouton **Analyser les séances** dans le tableau de bord pour forcer l'analyse.
- _Pas de notification push_ : uniquement sur une version installée via EAS (section 8), pas dans le navigateur
  (où les notifications apparaissent dans la cloche de l'app).
