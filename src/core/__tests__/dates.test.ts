import {
  formatFrenchDate,
  maskFrenchDate,
  formatLongDate,
  formatRelative,
  formatShortDate,
  formatTime,
  parseFrenchDate,
} from '../dates';

describe('dates françaises', () => {
  it('lit une date JJ/MM/AAAA', () => {
    expect(parseFrenchDate('31/12/1990')).toBe('1990-12-31');
    expect(parseFrenchDate(' 1.2.2001 ')).toBe('2001-02-01');
    expect(parseFrenchDate('29/02/2023')).toBeNull();
    expect(parseFrenchDate('29/02/2024')).toBe('2024-02-29');
    expect(parseFrenchDate('12/31/1990')).toBeNull();
    expect(parseFrenchDate('01/01/1800')).toBeNull();
    expect(parseFrenchDate('hier')).toBeNull();
  });
  it('affiche les dates', () => {
    expect(formatFrenchDate('1990-12-31')).toBe('31/12/1990');
    expect(formatLongDate('2026-11-16')).toBe('lundi 16 novembre');
    expect(formatLongDate('2026-12-01', true)).toBe('mardi 1er décembre 2026');
    expect(formatShortDate('2026-11-16')).toBe('16 nov.');
    expect(formatShortDate('2026-05-03')).toBe('3 mai');
  });
  it('affiche une heure et un temps relatif', () => {
    const now = new Date('2026-11-16T12:00:00Z');
    expect(formatTime(new Date(2026, 10, 16, 9, 5).toISOString())).toBe('09:05');
    expect(formatRelative('2026-11-16T11:59:40Z', now)).toBe('à l’instant');
    expect(formatRelative('2026-11-16T11:30:00Z', now)).toBe('il y a 30 min');
    expect(formatRelative('2026-11-16T08:00:00Z', now)).toBe('il y a 4 h');
    expect(formatRelative('2026-11-15T08:00:00Z', now)).toBe('hier');
    expect(formatRelative('2026-11-12T08:00:00Z', now)).toBe('il y a 4 jours');
    expect(formatRelative('2026-10-01T08:00:00Z', now)).toBe('1 oct.');
  });
});

describe('saisie de date avec « / » automatiques', () => {
  it('ajoute les barres pendant la frappe', () => {
    let v = '';
    for (const ch of '31121995') v = maskFrenchDate(v + ch, v);
    expect(v).toBe('31/12/1995');
    expect(maskFrenchDate('3', '')).toBe('3');
    expect(maskFrenchDate('31', '3')).toBe('31/');
  });

  it('permet d’effacer et accepte un collage', () => {
    expect(maskFrenchDate('31', '31/')).toBe('31');
    expect(maskFrenchDate('31/12', '31/12/')).toBe('31/12');
    expect(maskFrenchDate('31/12/1995')).toBe('31/12/1995');
    expect(maskFrenchDate('31121995')).toBe('31/12/1995');
    expect(maskFrenchDate('31/12/19950')).toBe('31/12/1995');
  });
});
