// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Liste des programmes du coach : recherche, filtres et tri.
 * TypeScript pur : testé unitairement.
 */

export type ProgramListItem = {
  name: string;
  status: string;
  adherent_id: string | null;
  source_template_id: string | null;
  start_date: string | null;
  updated_at: string;
  adherent: { first_name: string | null; last_name: string | null } | null;
};

export type ProgramFilters = {
  search?: string;
  adherentId?: string | null;
  status?: string | null;
  templateId?: string | null;
};

export const PROGRAM_SORTS = ['updated', 'startDate', 'adherent'] as const;
export type ProgramSort = (typeof PROGRAM_SORTS)[number];

/** Minuscules, sans accents : « Léa » trouve « lea ». */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function adherentLabel(item: Pick<ProgramListItem, 'adherent'>): string {
  return [item.adherent?.first_name, item.adherent?.last_name].filter(Boolean).join(' ');
}

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * Filtre puis trie :
 *  - updated : modifiés récemment d'abord ;
 *  - startDate : date de début la plus récente d'abord (sans date à la fin) ;
 *  - adherent : par adhérent (A → Z), puis date de début la plus récente.
 */
export function filterAndSortPrograms<T extends ProgramListItem>(
  items: readonly T[],
  filters: ProgramFilters,
  sort: ProgramSort,
): T[] {
  const q = normalizeText(filters.search ?? '');
  const filtered = items.filter(
    (p) =>
      (q === '' || normalizeText(`${p.name} ${adherentLabel(p)}`).includes(q)) &&
      (!filters.adherentId || p.adherent_id === filters.adherentId) &&
      (!filters.status || p.status === filters.status) &&
      (!filters.templateId || p.source_template_id === filters.templateId),
  );
  const byStart = (a: T, b: T) =>
    a.start_date === b.start_date
      ? 0
      : a.start_date === null
        ? 1
        : b.start_date === null
          ? -1
          : b.start_date.localeCompare(a.start_date);
  return [...filtered].sort((a, b) => {
    switch (sort) {
      case 'startDate':
        return byStart(a, b) || b.updated_at.localeCompare(a.updated_at);
      case 'adherent':
        return collator.compare(adherentLabel(a), adherentLabel(b)) || byStart(a, b);
      case 'updated':
        return b.updated_at.localeCompare(a.updated_at);
    }
  });
}
