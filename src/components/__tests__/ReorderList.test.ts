import { targetIndex } from '../ReorderList';

describe('glisser-déposer : calcul de la position', () => {
  const heights = [100, 100, 100, 100];
  it('reste en place pour un petit déplacement', () => {
    expect(targetIndex(heights, 1, 30, 12)).toBe(1);
    expect(targetIndex(heights, 1, -30, 12)).toBe(1);
  });
  it('descend d’une ou plusieurs places', () => {
    expect(targetIndex(heights, 0, 70, 12)).toBe(1);
    expect(targetIndex(heights, 0, 250, 12)).toBe(2);
    expect(targetIndex(heights, 0, 5000, 12)).toBe(3);
  });
  it('monte d’une ou plusieurs places', () => {
    expect(targetIndex(heights, 3, -70, 12)).toBe(2);
    expect(targetIndex(heights, 3, -5000, 12)).toBe(0);
  });
});
