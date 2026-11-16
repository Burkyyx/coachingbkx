# Élan — application de coaching sportif

> Nom provisoire. Application **iOS · Android · Web** pour le coaching d'Enzo :
> programmes d'entraînement, suivi des séances (même sans réseau), suggestions de progression
> validées par le coach, bilans hebdomadaires et messagerie.

Ce README est rédigé pour quelqu'un qui n'est pas développeur. Il sera complété au fil des étapes
(Supabase, publication sur les stores, déploiement web, sauvegardes).

## Démarrage rapide (sur ton Mac)

1. Installer **Node.js 22** : https://nodejs.org (bouton « LTS »).
2. Ouvrir le Terminal dans le dossier du projet, puis :
   ```bash
   npm install
   cp .env.example .env.local
   npm run web
   ```
3. L'app s'ouvre dans le navigateur sur http://localhost:8081.

## Commandes utiles

| Commande           | À quoi ça sert                                                 |
| ------------------ | -------------------------------------------------------------- |
| `npm run web`      | Lancer l'app dans le navigateur                                |
| `npm start`        | Lancer le serveur de développement (QR code pour le téléphone) |
| `npm run check`    | Vérifier le code (types, style, tests)                         |
| `npm run test:rls` | Tester les règles de sécurité de la base (Docker requis)       |
