// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Adhérents : âge, tranches d'âge, filtres et tri de la liste du coach.
 * TypeScript pur (aucune dépendance) : testé unitairement.
 */

/** Âge en années révolues à une date donnée (dates « AAAA-MM-JJ »). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = (ty ?? 0) - (by ?? 0);
  if ((tm ?? 0) < (bm ?? 0) || ((tm ?? 0) === (bm ?? 0) && (td ?? 0) < (bd ?? 0))) age--;
  return age;
}

export const AGE_BRACKETS = ['15-17', '18-24', '25-34', '35-44', '45-54', '55+'] as const;
export type AgeBracket = (typeof AGE_BRACKETS)[number];

/** Tranche d'âge (null si date de naissance inconnue ou âge < 15 ans). */
export function ageBracket(birthDate: string | null, today: string): AgeBracket | null {
  if (!birthDate) return null;
  const age = ageOn(birthDate, today);
  if (age < 15) return null;
  if (age <= 17) return '15-17';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  return '55+';
}

/** Champs nécessaires au filtrage / tri (sous-ensemble d'une ligne de la vue coach). */
export type AdherentListItem = {
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  sex: string | null;
  goal: string | null;
  is_active: boolean;
  last_session_at: string | null;
  sessions_planned_28d: number;
  sessions_done_28d: number;
};

export type AdherentFilters = {
  age?: AgeBracket | null;
  sex?: string | null;
  goal?: string | null;
};

export const ADHERENT_SORTS = ['name', 'age', 'lastSession', 'attendance'] as const;
export type AdherentSort = (typeof ADHERENT_SORTS)[number];

/** Assiduité sur 28 jours (0 à 1), null si aucune séance prévue. */
export function attendanceRate(
  item: Pick<AdherentListItem, 'sessions_planned_28d' | 'sessions_done_28d'>,
) {
  return item.sessions_planned_28d > 0 ? item.sessions_done_28d / item.sessions_planned_28d : null;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * Filtre puis trie. Les adhérents désactivés restent toujours en fin de liste ;
 * les valeurs inconnues (âge, dernière séance, assiduité) passent après les connues.
 */
export function filterAndSortAdherents<T extends AdherentListItem>(
  items: readonly T[],
  filters: AdherentFilters,
  sort: AdherentSort,
  today: string,
): T[] {
  const filtered = items.filter(
    (it) =>
      (!filters.age || ageBracket(it.birth_date, today) === filters.age) &&
      (!filters.sex || it.sex === filters.sex) &&
      (!filters.goal || it.goal === filters.goal),
  );
  const name = (it: T) => `${it.first_name ?? ''} ${it.last_name ?? ''}`.trim();
  const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) =>
    a === null && b === null ? 0 : a === null ? 1 : b === null ? -1 : (a - b) * dir;

  return [...filtered].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    let diff = 0;
    switch (sort) {
      case 'age':
        // Du plus jeune au plus âgé : date de naissance la plus récente d'abord.
        diff = nullsLast(
          a.birth_date ? Date.parse(a.birth_date) : null,
          b.birth_date ? Date.parse(b.birth_date) : null,
          -1,
        );
        break;
      case 'lastSession':
        // Les plus anciennes d'abord : ceux qui ne s'entraînent plus remontent.
        diff = nullsLast(
          a.last_session_at ? Date.parse(a.last_session_at) : null,
          b.last_session_at ? Date.parse(b.last_session_at) : null,
          1,
        );
        break;
      case 'attendance':
        // Assiduité la plus faible d'abord : ceux à relancer en premier.
        diff = nullsLast(attendanceRate(a), attendanceRate(b), 1);
        break;
      case 'name':
        break;
    }
    return diff !== 0 ? diff : collator.compare(name(a), name(b));
  });
}
