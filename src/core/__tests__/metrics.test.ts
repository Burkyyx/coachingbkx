import {
  formatDuration,
  formatKg,
  formatInt,
  formatNumber,
  formatRepRange,
  formatSigned,
  formatTimer,
} from '../format';
import { detectSessionVolumeRecord, detectSetRecord } from '../metrics/records';
import {
  addDays,
  adherenceRate,
  daysBetween,
  isoWeekday,
  programWeekIndex,
  todayLocal,
  weekStart,
  workoutDate,
} from '../metrics/schedule';
import {
  best1RM,
  epley1RM,
  exerciseProgress,
  maxLoad,
  setVolume,
  totalVolume,
} from '../metrics/strength';
import { trendDelta, weeklyTrendRate, weightTrend } from '../metrics/weightTrend';
import { effectiveRir, targetRirOf } from '../types';
import { clamp, floorToStep, mean, mode, roundToStep } from '../units';

import { session, set } from '../testing/factories';

describe('format', () => {
  it('formate les nombres à la française', () => {
    expect(formatNumber(62.5)).toBe('62,5');
    expect(formatInt(1349.4)).toBe('1\u202F349');
    expect(formatInt(12500)).toBe('12\u202F500');
    expect(formatInt(950)).toBe('950');
    expect(formatInt(-2500)).toBe('−2\u202F500');
    expect(formatNumber(60)).toBe('60');
    expect(formatNumber(2.256)).toBe('2,26');
    expect(formatKg(62.5)).toBe('62,5 kg');
    expect(formatSigned(2.5)).toBe('+2,5');
    expect(formatSigned(-5)).toBe('−5');
  });
  it('formate les durées et minuteurs', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(90)).toBe('1 min 30');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(3900)).toBe('1 h 05');
    expect(formatDuration(7200)).toBe('2 h');
    expect(formatTimer(95)).toBe('1:35');
    expect(formatTimer(-3)).toBe('0:00');
  });
  it('formate les fourchettes de reps', () => {
    expect(formatRepRange(8, 12)).toBe('8–12');
    expect(formatRepRange(10, 10)).toBe('10');
    expect(formatRepRange(null, 5)).toBe('5');
    expect(formatRepRange(6, null)).toBe('6');
    expect(formatRepRange(null, null)).toBe('—');
  });
});

describe('units', () => {
  it('arrondit aux incréments', () => {
    expect(roundToStep(61.3, 2.5)).toBe(62.5);
    expect(roundToStep(61.2, 2.5)).toBe(60);
    expect(floorToStep(56.9, 2.5)).toBe(55);
    expect(floorToStep(55, 2.5)).toBe(55);
    expect(roundToStep(10, 0)).toBe(10);
    expect(floorToStep(10, 0)).toBe(10);
  });
  it('calcule moyenne, mode, bornes', () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4])).toBe(3);
    expect(mode([])).toBeNull();
    expect(mode([60, 60, 62.5])).toBe(60);
    expect(mode([60, 62.5])).toBe(62.5);
    expect(clamp(12, 0, 10)).toBe(10);
  });
});

describe('RIR effectif', () => {
  it('utilise le RIR, sinon déduit du RPE', () => {
    expect(effectiveRir({ rir: 2, rpe: null })).toBe(2);
    expect(effectiveRir({ rir: null, rpe: 8 })).toBe(2);
    expect(effectiveRir({ rir: null, rpe: null })).toBeNull();
    expect(targetRirOf({ targetRir: null, targetRpe: 9 })).toBe(1);
    expect(targetRirOf({ targetRir: 3, targetRpe: 9 })).toBe(3);
    expect(targetRirOf({ targetRir: null, targetRpe: null })).toBeNull();
  });
});

describe('force et volume', () => {
  it('calcule le 1RM estimé (Epley)', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley1RM(60, 0)).toBeNull();
    expect(epley1RM(null, 8)).toBeNull();
    expect(epley1RM(0, 8)).toBeNull();
  });
  it('calcule le volume des séries de travail validées seulement', () => {
    const sets = [
      set(40, 10, { setType: 'warmup' }),
      set(60, 10),
      set(60, 8),
      set(60, 5, { completed: false }),
    ];
    expect(setVolume(set(60, 10))).toBe(600);
    expect(setVolume(set(null, 10))).toBe(0);
    expect(totalVolume(sets)).toBe(1080);
    expect(maxLoad(sets)).toBe(60);
    expect(best1RM(sets)).toBeCloseTo(80, 1);
    expect(maxLoad([])).toBeNull();
    expect(best1RM([])).toBeNull();
  });
  it('produit la courbe de progression triée par date', () => {
    const points = exerciseProgress([
      session('2026-02-10', [[62.5, 10]]),
      session('2026-02-03', [[60, 10]]),
    ]);
    expect(points.map((p) => p.date)).toEqual(['2026-02-03', '2026-02-10']);
    expect(points[1]?.maxLoad).toBe(62.5);
    expect(points[0]?.volume).toBe(600);
  });
});

describe('records', () => {
  const history = [set(60, 10), set(60, 9), set(57.5, 12)];
  it('aucun record sans historique', () => {
    expect(detectSetRecord(set(100, 5), [])).toBeNull();
  });
  it('ignore échauffements, séries ratées et séries sans reps', () => {
    expect(detectSetRecord(set(100, 5, { setType: 'warmup' }), history)).toBeNull();
    expect(detectSetRecord(set(100, 5, { completed: false }), history)).toBeNull();
    expect(detectSetRecord(set(100, 0), history)).toBeNull();
  });
  it('détecte un record de charge', () => {
    expect(detectSetRecord(set(62.5, 6), history)).toEqual({
      recordType: 'max_load',
      value: 62.5,
      loadKg: 62.5,
      previous: 60,
    });
  });
  it('détecte un record de 1RM estimé', () => {
    const r = detectSetRecord(set(60, 12), history);
    expect(r?.recordType).toBe('estimated_1rm');
    expect(r?.value).toBe(84);
  });
  it('détecte un record de reps à une charge', () => {
    // 57,5 × 13 : 1RM estimé 82,4 < 80 + 0,5 ? Non : 82,4 > 80,5 → c'est un 1RM.
    // On teste donc un cas où le 1RM n'est pas battu : historique plus lourd.
    const h = [set(80, 5), set(50, 10)];
    const r = detectSetRecord(set(50, 11), h);
    expect(r).toEqual({ recordType: 'reps_at_load', value: 11, loadKg: 50, previous: 10 });
  });
  it('pas de record si la performance est égale', () => {
    expect(detectSetRecord(set(60, 10), history)).toBeNull();
  });
  it('gère les exercices au poids du corps (reps)', () => {
    const h = [set(null, 12), set(null, 15)];
    expect(detectSetRecord(set(null, 16), h)?.recordType).toBe('reps_at_load');
    expect(detectSetRecord(set(null, 15), h)).toBeNull();
  });
  it('détecte un record de volume de séance', () => {
    const prev = [
      session('2026-01-01', [
        [60, 10],
        [60, 10],
      ]),
    ];
    expect(detectSessionVolumeRecord([set(60, 10), set(60, 11)], prev)?.value).toBe(1260);
    expect(detectSessionVolumeRecord([set(60, 10), set(60, 10)], prev)).toBeNull();
    expect(detectSessionVolumeRecord([set(60, 10)], [])).toBeNull();
    expect(detectSessionVolumeRecord([], prev)).toBeNull();
  });
});

describe('calendrier', () => {
  it('calcule jours ISO, lundis et écarts', () => {
    expect(isoWeekday('2026-11-16')).toBe(1); // lundi
    expect(isoWeekday('2026-11-22')).toBe(7); // dimanche
    expect(weekStart('2026-11-19')).toBe('2026-11-16');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-11-16', '2026-11-23')).toBe(7);
  });
  it('date prévue d’une séance (même règle que la fonction SQL)', () => {
    // Programme démarrant un mercredi : la semaine 1 commence le lundi précédent.
    expect(workoutDate('2026-11-18', 1, 1)).toBe('2026-11-16');
    expect(workoutDate('2026-11-18', 2, 3)).toBe('2026-11-25');
    expect(programWeekIndex('2026-11-18', '2026-11-30')).toBe(3);
    expect(programWeekIndex('2026-11-18', '2026-11-10')).toBe(0);
  });
  it('date du jour locale', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
  it('taux d’assiduité', () => {
    expect(adherenceRate(0, 0)).toBeNull();
    expect(adherenceRate(12, 9)).toBe(75);
    expect(adherenceRate(4, 6)).toBe(100);
  });
});

describe('tendance de poids', () => {
  it('lisse les variations quotidiennes', () => {
    const t = weightTrend([
      { date: '2026-01-01', kg: 80 },
      { date: '2026-01-02', kg: 82 },
    ]);
    expect(t[0]?.trend).toBe(80);
    expect(t[1]?.trend).toBe(80.2);
  });
  it('tient compte des jours sans pesée', () => {
    const t = weightTrend([
      { date: '2026-01-01', kg: 80 },
      { date: '2026-01-11', kg: 78 },
    ]);
    // alpha effectif = 1 − 0,9^10 ≈ 0,651
    expect(t[1]?.trend).toBeCloseTo(78.7, 1);
  });
  it('calcule la vitesse hebdomadaire en %', () => {
    const points = Array.from({ length: 21 }, (_, i) => ({
      date: addDays('2026-01-01', i),
      kg: 80 - i * 0.1,
    }));
    const rate = weeklyTrendRate(weightTrend(points, 1));
    expect(rate).toBeCloseTo(-0.9, 1);
    expect(trendDelta(weightTrend(points, 1))).toBe(-2);
  });
  it('renvoie null sans données suffisantes', () => {
    expect(weeklyTrendRate([])).toBeNull();
    expect(
      weeklyTrendRate(
        weightTrend([
          { date: '2026-01-01', kg: 80 },
          { date: '2026-01-02', kg: 80 },
        ]),
      ),
    ).toBeNull();
    expect(
      weeklyTrendRate(
        weightTrend([
          { date: '2026-01-01', kg: 80 },
          { date: '2026-01-10', kg: 80 },
        ]),
        5,
      ),
    ).toBeNull();
    expect(trendDelta([])).toBeNull();
  });
});
