import { filterAndSortPrograms, type ProgramListItem } from '../programs';

const item = (o: Partial<ProgramListItem> & { name: string }): ProgramListItem => ({
  status: 'active',
  adherent_id: null,
  source_template_id: null,
  start_date: null,
  updated_at: '2026-11-01T10:00:00Z',
  adherent: null,
  ...o,
});

const julie = { first_name: 'Julie', last_name: 'Martin' };
const lea = { first_name: 'Léa', last_name: 'Moreau' };

const a = item({
  name: 'PPL intermédiaire',
  adherent_id: 'j',
  adherent: julie,
  source_template_id: 'ppl',
  start_date: '2026-09-21',
  updated_at: '2026-11-10T10:00:00Z',
});
const b = item({
  name: 'Full body débutant',
  adherent_id: 'l',
  adherent: lea,
  source_template_id: 'fb',
  start_date: '2026-10-05',
  status: 'completed',
  updated_at: '2026-11-12T10:00:00Z',
});
const c = item({
  name: 'PPL intermédiaire',
  adherent_id: 'l',
  adherent: lea,
  source_template_id: 'ppl',
  status: 'draft',
  updated_at: '2026-11-05T10:00:00Z',
});
const all = [a, b, c];

describe('programmes des adhérents : filtres et tri', () => {
  it('recherche dans le nom du programme et de l’adhérent, sans accents', () => {
    expect(filterAndSortPrograms(all, { search: 'lea' }, 'updated')).toEqual([b, c]);
    expect(filterAndSortPrograms(all, { search: 'full' }, 'updated')).toEqual([b]);
    expect(filterAndSortPrograms(all, { search: 'martin ppl' }, 'updated')).toEqual([]);
  });

  it('filtre par adhérent, statut et modèle d’origine (cumulables)', () => {
    expect(filterAndSortPrograms(all, { adherentId: 'l' }, 'updated')).toEqual([b, c]);
    expect(filterAndSortPrograms(all, { status: 'active' }, 'updated')).toEqual([a]);
    expect(filterAndSortPrograms(all, { templateId: 'ppl' }, 'updated')).toEqual([a, c]);
    expect(filterAndSortPrograms(all, { templateId: 'ppl', adherentId: 'l' }, 'updated')).toEqual([
      c,
    ]);
  });

  it('trie par modification, date de début ou adhérent', () => {
    expect(filterAndSortPrograms(all, {}, 'updated')).toEqual([b, a, c]);
    expect(filterAndSortPrograms(all, {}, 'startDate')).toEqual([b, a, c]);
    expect(filterAndSortPrograms(all, {}, 'adherent')).toEqual([a, b, c]);
  });
});
