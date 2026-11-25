import {
  challengeProgress,
  DEFAULT_XP_RULES,
  isBadgeKey,
  levelFor,
  sanitizeXpRules,
} from '../community/progression';

describe('niveaux', () => {
  it('calcule le niveau et l’avancement', () => {
    expect(levelFor(0)).toEqual({ index: 0, min: 0, next: 200, progress: 0 });
    expect(levelFor(400)).toEqual({ index: 1, min: 200, next: 600, progress: 0.5 });
    expect(levelFor(8000)).toEqual({ index: 7, min: 8000, next: null, progress: 1 });
    expect(levelFor(-50).index).toBe(0);
  });
});

describe('barème d’XP', () => {
  it('complète et borne les valeurs', () => {
    expect(sanitizeXpRules(null)).toEqual(DEFAULT_XP_RULES);
    expect(sanitizeXpRules({ session: '35', record: -4, daily_cap: 99999, checkin: 'x' })).toEqual({
      ...DEFAULT_XP_RULES,
      session: 35,
      record: 0,
      daily_cap: 2000,
    });
  });
});

describe('badges et challenges', () => {
  it('reconnaît les badges et borne l’avancement', () => {
    expect(isBadgeKey('sessions_10')).toBe(true);
    expect(isBadgeKey('poids_perdu')).toBe(false);
    expect(challengeProgress(6, 12)).toBe(0.5);
    expect(challengeProgress(20, 12)).toBe(1);
    expect(challengeProgress(3, 0)).toBe(0);
  });
});
