import { MUSCLES } from '../api';
import { musclesForZone, zonesForMuscles, type BodySlug } from '../bodyZones';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('schéma du corps ↔ groupes musculaires', () => {
  it('distingue l’avant et l’arrière de l’épaule selon la vue', () => {
    expect(musclesForZone('deltoids', 'front')).toEqual(['shoulders']);
    expect(musclesForZone('deltoids', 'back')).toEqual(['rear_delts']);
  });

  it('le haut du dos regroupe dos et grand dorsal', () => {
    expect(musclesForZone('upper-back', 'back')).toEqual(['back', 'lats']);
  });

  it('chaque muscle du corps est atteignable depuis le schéma', () => {
    const slugs: BodySlug[] = [
      'abs',
      'adductors',
      'biceps',
      'calves',
      'chest',
      'deltoids',
      'forearm',
      'gluteal',
      'hamstring',
      'lower-back',
      'obliques',
      'quadriceps',
      'tibialis',
      'trapezius',
      'triceps',
      'upper-back',
    ];
    const reachable = new Set(
      slugs.flatMap((s) => [...musclesForZone(s, 'front'), ...musclesForZone(s, 'back')]),
    );
    const bodyMuscles = MUSCLES.filter((m) => m !== 'full_body' && m !== 'cardio');
    expect(bodyMuscles.filter((m) => !reachable.has(m))).toEqual([]);
  });

  it('surligne les bonnes zones sur chaque vue', () => {
    expect(zonesForMuscles(['back', 'lats'], 'back')).toEqual(['upper-back']);
    expect(zonesForMuscles(['back', 'lats'], 'front')).toEqual([]);
    expect(zonesForMuscles(['shoulders'], 'front')).toEqual(['deltoids']);
    expect(zonesForMuscles(['shoulders'], 'back')).toEqual([]);
    expect(zonesForMuscles(['calves'], 'front')).toEqual(['calves', 'tibialis']);
    expect(zonesForMuscles([], 'front')).toEqual([]);
  });
});
