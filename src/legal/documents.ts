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
          'Données et serveurs : Supabase Inc. — hébergement des données dans l’Union européenne (région [À COMPLÉTER : ex. Paris / Francfort]).',
          'Site web : [À COMPLÉTER : ex. Cloudflare Inc., 101 Townsend St, San Francisco, CA 94107, USA].',
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
    updatedAt: '[À COMPLÉTER : date]',
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
        ],
      },
      {
        title: 'Base légale',
        paragraphs: [
          'Exécution du contrat de coaching et consentement explicite, séparé et révocable pour les données d’entraînement et les données corporelles.',
        ],
      },
      {
        title: 'Destinataires',
        paragraphs: [
          'Seul le coach a accès aux données. Aucune donnée n’est vendue ni utilisée à des fins publicitaires.',
          'Sous-traitants : Supabase (hébergement des données dans l’UE), [À COMPLÉTER : Expo pour les notifications push, fournisseur d’envoi d’e-mails].',
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
