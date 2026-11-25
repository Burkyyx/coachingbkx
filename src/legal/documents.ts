/**
 * MODÈLES DE DOCUMENTS JURIDIQUES — À FAIRE RELIRE PAR UN PROFESSIONNEL.
 * Les champs [À COMPLÉTER] doivent être remplis avant la mise en ligne.
 * Après une modification importante, incrémenter CONSENT_VERSION
 * (src/features/auth/consents.ts) pour redemander l'accord des adhérents.
 */

export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDocument = { title: string; updatedAt: string; sections: LegalSection[] };
export type LegalDocId = 'mentions' | 'terms' | 'privacy';

const COACH = '[À COMPLÉTER : nom et prénom du coach / raison sociale]';
const CONTACT = '[À COMPLÉTER : adresse e-mail de contact]';

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  mentions: {
    title: 'Mentions légales',
    updatedAt: '[À COMPLÉTER : date]',
    sections: [
      {
        title: 'Éditeur de l’application',
        paragraphs: [
          `${COACH}, coach sportif indépendant.`,
          'Statut : [À COMPLÉTER : micro-entreprise, EI, société…] — SIRET : [À COMPLÉTER].',
          'Adresse : [À COMPLÉTER].',
          `Contact : ${CONTACT}.`,
          'Directeur de la publication : [À COMPLÉTER].',
        ],
      },
      {
        title: 'Hébergement',
        paragraphs: [
          'Données et serveurs : Supabase Inc. — hébergement des données dans l’Union européenne (Irlande).',
          'Site web : Cloudflare Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis (Cloudflare Pages).',
        ],
      },
      {
        title: 'Propriété intellectuelle',
        paragraphs: [
          'Les programmes d’entraînement, textes et vidéos de démonstration sont la propriété de l’éditeur. Toute reproduction sans autorisation est interdite.',
        ],
      },
    ],
  },
  terms: {
    title: 'Conditions générales d’utilisation',
    updatedAt: '[À COMPLÉTER : date]',
    sections: [
      {
        title: '1. Objet',
        paragraphs: [
          `L’application est fournie gratuitement par ${COACH} à ses clients en coaching, dans le cadre de son offre de coaching. Elle permet de suivre les programmes d’entraînement, d’enregistrer ses séances et d’échanger avec le coach.`,
        ],
      },
      {
        title: '2. Accès',
        paragraphs: [
          'L’inscription se fait uniquement sur invitation du coach. L’utilisateur doit avoir au moins 15 ans.',
          'Le coach peut désactiver un compte (fin du coaching, usage abusif). Les données sont alors conservées selon la politique de confidentialité.',
        ],
      },
      {
        title: '3. Santé et responsabilité',
        paragraphs: [
          'L’application ne remplace pas un avis médical ou celui d’un diététicien. En cas de douleur, de malaise ou de doute, l’utilisateur arrête l’exercice et consulte un professionnel de santé.',
          'Les suggestions automatiques sont des aides : elles sont validées par le coach avant d’être appliquées. L’utilisateur reste responsable de l’exécution des exercices.',
          'L’utilisateur s’engage à signaler au coach toute blessure, contre-indication ou condition médicale pertinente.',
        ],
      },
      {
        title: '4. Comportement',
        paragraphs: [
          'Les messages et contenus envoyés doivent rester respectueux. Tout contenu illicite, injurieux ou portant atteinte à autrui peut entraîner la suspension du compte.',
        ],
      },
      {
        title: '5. Données personnelles',
        paragraphs: ['Voir la politique de confidentialité.'],
      },
      {
        title: '6. Modification et résiliation',
        paragraphs: [
          'Les présentes conditions peuvent évoluer ; l’utilisateur en est informé et doit les accepter à nouveau.',
          'L’utilisateur peut supprimer son compte à tout moment depuis son profil.',
        ],
      },
      {
        title: '7. Droit applicable',
        paragraphs: ['Droit français. Tribunal compétent : [À COMPLÉTER].'],
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    updatedAt: '25 novembre 2026',
    sections: [
      {
        title: 'Responsable du traitement',
        paragraphs: [`${COACH}. Contact : ${CONTACT}.`],
      },
      {
        title: 'Données collectées et finalités',
        paragraphs: [
          'Compte et profil (nom, prénom, e-mail, date de naissance, sexe, taille, niveau, objectif) : gestion du compte et personnalisation du coaching.',
          'Blessures et contraintes : adaptation des programmes ; visibles uniquement par l’utilisateur et le coach.',
          'Données d’entraînement (séances, charges, répétitions, ressenti, temps de repos, records) : suivi et adaptation du programme par le coach.',
          'Bilans hebdomadaires, pesées et photos de progression (données potentiellement de santé) : suivi de l’évolution, uniquement avec le consentement explicite de l’utilisateur.',
          'Messages, photos et vidéos envoyés au coach : correction technique et échanges.',
          'Alimentation (repas, quantités, valeurs nutritionnelles, photos de repas, objectifs nutritionnels fixés par le coach) : suivi nutritionnel, uniquement avec le consentement explicite de l’utilisateur (données potentiellement de santé).',
          'Analyse des photos de repas par intelligence artificielle : estimation des aliments et de leurs valeurs, que l’utilisateur vérifie et corrige avant d’enregistrer ; uniquement avec un consentement spécifique, séparé et révocable. Le nombre d’analyses et leur coût sont enregistrés pour le suivi du service.',
        ],
      },
      {
        title: 'Base légale',
        paragraphs: [
          'Exécution du contrat de coaching et consentement explicite, séparé et révocable pour les données d’entraînement, les données corporelles et nutritionnelles, et l’analyse des photos de repas par intelligence artificielle.',
        ],
      },
      {
        title: 'Destinataires',
        paragraphs: [
          'Seul le coach a accès aux données. Aucune donnée n’est vendue ni utilisée à des fins publicitaires.',
          'Sous-traitants : Supabase (hébergement de la base de données et des fichiers, serveurs dans l’Union européenne, Irlande) ; Cloudflare (hébergement du site web) ; Brevo (envoi des e-mails de confirmation et de mot de passe, France) ; Expo (acheminement des notifications sur téléphone).',
          'Analyse des photos de repas : Anthropic PBC (États-Unis), via son service Claude. Seule la photo du repas est transmise, accompagnée le cas échéant de la précision écrite par l’utilisateur ; aucun nom, adresse e-mail ni identifiant n’est envoyé. Anthropic agit comme sous-traitant : il s’engage contractuellement à n’utiliser ces données que pour fournir l’analyse, à ne pas s’en servir pour entraîner ses modèles et à ne les conserver que pour une durée limitée. Ce transfert hors de l’Union européenne est encadré par les clauses contractuelles types de la Commission européenne prévues par son contrat de traitement des données. Sans ce consentement, aucune photo n’est envoyée et la saisie reste manuelle.',
          'Recherche par code-barres : seul le code-barres scanné est envoyé à la base publique Open Food Facts (association, France) pour obtenir les valeurs nutritionnelles du produit ; aucune donnée personnelle n’y est transmise.',
          'Vidéos de démonstration intégrées : lecteur YouTube (Google) en mode « confidentialité renforcée » (youtube-nocookie.com) ; aucune donnée de l’app n’est transmise, mais YouTube peut recevoir l’adresse IP de l’appareil au moment de la lecture.',
        ],
      },
      {
        title: 'Durée de conservation',
        paragraphs: [
          'Pendant la durée du coaching, puis [À COMPLÉTER : ex. 3 ans] après la fin de la relation, sauf demande de suppression.',
        ],
      },
      {
        title: 'Sécurité',
        paragraphs: [
          'Accès réservé (chaque adhérent ne voit que ses propres données), fichiers privés accessibles par liens temporaires, hébergement dans l’Union européenne.',
        ],
      },
      {
        title: 'Supprimer votre compte',
        paragraphs: [
          'Dans l’app (téléphone ou site web) : Profil → « Supprimer mon compte », puis confirmer. La suppression est immédiate et définitive : compte, séances, bilans, pesées, repas, photos, vidéos et messages sont effacés.',
          `Vous pouvez aussi demander la suppression par e-mail à ${CONTACT} ; elle est effectuée sous 30 jours au plus.`,
        ],
      },
      {
        title: 'Vos droits',
        paragraphs: [
          'Accès, rectification, effacement, portabilité, opposition et retrait du consentement à tout moment.',
          'Depuis l’app (Profil) : export de vos données (JSON et CSV), révocation des consentements, suppression définitive du compte.',
          `Pour toute demande : ${CONTACT}. Réclamation possible auprès de la CNIL (www.cnil.fr).`,
        ],
      },
    ],
  },
};

export function isLegalDocId(value: string): value is LegalDocId {
  return value === 'mentions' || value === 'terms' || value === 'privacy';
}
