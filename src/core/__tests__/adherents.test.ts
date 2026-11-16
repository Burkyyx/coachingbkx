import { ageBracket, ageOn, filterAndSortAdherents, type AdherentListItem } from '../adherents';

const TODAY = '2026-11-16';

const base: AdherentListItem = {
  first_name: null,
  last_name: null,
  birth_date: null,
  sex: null,
  goal: null,
  is_active: true,
  last_session_at: null,
  sessions_planned_28d: 0,
  sessions_done_28d: 0,
};
const make = (o: Partial<AdherentListItem>): AdherentListItem => ({ ...base, ...o });

describe('âge et tranches', () => {
  it('calcule l’âge en années révolues', () => {
    expect(ageOn('2000-11-17', TODAY)).toBe(25);
    expect(ageOn('2000-11-16', TODAY)).toBe(26);
  });

  it('classe dans la bonne tranche, bornes incluses', () => {
    expect(ageBracket('2011-11-16', TODAY)).toBe('15-17');
    expect(ageBracket('2008-11-17', TODAY)).toBe('15-17');
    expect(ageBracket('2008-11-16', TODAY)).toBe('18-24');
    expect(ageBracket('2001-11-16', TODAY)).toBe('25-34');
    expect(ageBracket('1991-11-17', TODAY)).toBe('25-34');
    expect(ageBracket('1991-11-16', TODAY)).toBe('35-44');
    expect(ageBracket('1972-01-01', TODAY)).toBe('45-54');
    expect(ageBracket('1960-01-01', TODAY)).toBe('55+');
    expect(ageBracket('2015-01-01', TODAY)).toBeNull();
    expect(ageBracket(null, TODAY)).toBeNull();
  });
});

describe('filtre et tri des adhérents', () => {
  const julie = make({
    first_name: 'Julie',
    birth_date: '1994-03-14',
    sex: 'female',
    goal: 'recomposition',
    last_session_at: '2026-11-14T10:00:00Z',
    sessions_planned_28d: 10,
    sessions_done_28d: 9,
  });
  const thomas = make({
    first_name: 'Thomas',
    birth_date: '2003-06-01',
    sex: 'male',
    goal: 'muscle_gain',
    last_session_at: '2026-11-02T10:00:00Z',
    sessions_planned_28d: 10,
    sessions_done_28d: 4,
  });
  const lea = make({ first_name: 'Léa', sex: 'female', goal: 'health' });
  const ancien = make({ first_name: 'Aaron', is_active: false, sex: 'male' });
  const all = [thomas, ancien, julie, lea];

  it('filtre par sexe, objectif et tranche d’âge (cumulables)', () => {
    expect(filterAndSortAdherents(all, { sex: 'female' }, 'name', TODAY)).toEqual([julie, lea]);
    expect(filterAndSortAdherents(all, { goal: 'muscle_gain' }, 'name', TODAY)).toEqual([thomas]);
    expect(filterAndSortAdherents(all, { age: '18-24' }, 'name', TODAY)).toEqual([thomas]);
    expect(filterAndSortAdherents(all, { age: '25-34', sex: 'male' }, 'name', TODAY)).toEqual([]);
  });

  it('trie par nom (accents gérés), désactivés en dernier', () => {
    expect(filterAndSortAdherents(all, {}, 'name', TODAY)).toEqual([julie, lea, thomas, ancien]);
  });

  it('trie par âge, inconnus à la fin', () => {
    expect(filterAndSortAdherents(all, {}, 'age', TODAY)).toEqual([thomas, julie, lea, ancien]);
  });

  it('trie par dernière séance : la plus ancienne d’abord', () => {
    expect(filterAndSortAdherents(all, {}, 'lastSession', TODAY)).toEqual([
      thomas,
      julie,
      lea,
      ancien,
    ]);
  });

  it('trie par assiduité : la plus faible d’abord', () => {
    expect(filterAndSortAdherents(all, {}, 'attendance', TODAY)).toEqual([
      thomas,
      julie,
      lea,
      ancien,
    ]);
  });
});
