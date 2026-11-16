import { evaluateDoubleProgression, sessionWorkingLoad } from '../algorithms/doubleProgression';
import { evaluateFatigue, rirDeficits, type FatigueSession } from '../algorithms/fatigue';
import { evaluateRestTime } from '../algorithms/restTime';
import { DEFAULT_PARAMS, resolveRule, sanitizeParams, type RuleRow } from '../algorithms/rules';
import {
  evaluateStagnation,
  lastSessionChangePercent,
  proposeRepRange,
} from '../algorithms/stagnation';
import { prescription, session, set } from '../testing/factories';

const dp = DEFAULT_PARAMS.double_progression;

function progression(
  sessions: ReturnType<typeof session>[],
  opts: Partial<Parameters<typeof evaluateDoubleProgression>[0]> = {},
) {
  return evaluateDoubleProgression({
    exerciseName: 'Développé couché',
    incrementKg: 2.5,
    loadable: true,
    prescription: prescription(),
    sessions,
    params: dp,
    ...opts,
  });
}

describe('règles : paramètres réglables par le coach', () => {
  const rows: RuleRow[] = [
    {
      ruleKey: 'double_progression',
      adherentId: null,
      exerciseId: null,
      params: { decreasePercent: 5 },
      enabled: true,
      autoApply: false,
    },
    {
      ruleKey: 'double_progression',
      adherentId: 'a1',
      exerciseId: null,
      params: { sessionsAtTopRequired: 2 },
      enabled: true,
      autoApply: true,
    },
    {
      ruleKey: 'double_progression',
      adherentId: null,
      exerciseId: 'e1',
      params: { sessionsAtTopRequired: 3 },
      enabled: true,
      autoApply: false,
    },
    {
      ruleKey: 'double_progression',
      adherentId: 'a1',
      exerciseId: 'e1',
      params: {},
      enabled: false,
      autoApply: false,
    },
  ];
  it('utilise les valeurs par défaut sans surcharge', () => {
    const r = resolveRule('stagnation', [], 'a1');
    expect(r).toEqual({ params: DEFAULT_PARAMS.stagnation, enabled: true, autoApply: false });
  });
  it('cumule global → adhérent', () => {
    const r = resolveRule('double_progression', rows, 'a1', 'e2');
    expect(r.params.decreasePercent).toBe(5);
    expect(r.params.sessionsAtTopRequired).toBe(2);
    expect(r.autoApply).toBe(true);
  });
  it('la règle la plus précise gagne (adhérent + exercice)', () => {
    const r = resolveRule('double_progression', rows, 'a1', 'e1');
    expect(r.params.sessionsAtTopRequired).toBe(3);
    expect(r.enabled).toBe(false);
  });
  it('ignore les règles des autres adhérents', () => {
    expect(resolveRule('double_progression', rows, 'a2', 'e2').params.sessionsAtTopRequired).toBe(
      1,
    );
  });
  it('nettoie et borne les paramètres saisis', () => {
    expect(
      sanitizeParams('fatigue', {
        volumeFactor: 0.1,
        minSignals: '3',
        inconnu: 1,
        ratingThreshold: 9,
      }),
    ).toEqual({ volumeFactor: 0.4, ratingThreshold: 9 });
    expect(
      sanitizeParams('double_progression', {
        suggestRepTarget: false,
        decreasePercent: Number.NaN,
      }),
    ).toEqual({
      suggestRepTarget: false,
    });
    expect(sanitizeParams('stagnation', { preferredAction: 'deload' })).toEqual({
      preferredAction: 'deload',
    });
    expect(sanitizeParams('stagnation', { preferredAction: 'magie' })).toEqual({});
  });
});

describe('§8.1 double progression', () => {
  it('haut de fourchette sur toutes les séries avec RIR suffisant → +2,5 kg', () => {
    const out = progression([
      session('2026-01-05', [
        [60, 12, 2],
        [60, 12, 2],
        [60, 12, 3],
      ]),
    ]);
    expect(out).toMatchObject({
      kind: 'load',
      direction: 'increase',
      currentLoadKg: 60,
      proposedLoadKg: 62.5,
    });
    expect(out?.justification).toBe(
      'Dernière séance à 12 reps ou plus sur toutes les séries de travail avec RIR ≥ 2 → +2,5 kg proposé (60 kg → 62,5 kg).',
    );
  });
  it('utilise l’incrément de l’exercice (5 kg pour le bas du corps)', () => {
    const out = progression(
      [
        session('2026-01-05', [
          [100, 12, 2],
          [100, 12, 2],
        ]),
      ],
      { incrementKg: 5 },
    );
    expect(out).toMatchObject({ proposedLoadKg: 105 });
  });
  it('exige le nombre de séances configuré', () => {
    const params = { ...dp, sessionsAtTopRequired: 3 };
    const s = (d: string) =>
      session(d, [
        [60, 12, 2],
        [60, 12, 2],
      ]);
    expect(progression([s('2026-01-01'), s('2026-01-03')], { params })?.kind).not.toBe('load');
    const out = progression([s('2026-01-01'), s('2026-01-03'), s('2026-01-05')], { params });
    expect(out?.justification).toContain('3 séances d’affilée');
  });
  it('pas de hausse si une série n’atteint pas le haut de fourchette', () => {
    const out = progression([
      session('2026-01-05', [
        [60, 12, 2],
        [60, 11, 2],
      ]),
    ]);
    expect(out?.kind).toBe('reps_target');
  });
  it('pas de hausse si le RIR est sous la cible (série trop dure)', () => {
    const out = progression([
      session('2026-01-05', [
        [60, 12, 0],
        [60, 12, 1],
      ]),
    ]);
    expect(out?.kind).not.toBe('load');
  });
  it('accepte le RPE à la place du RIR', () => {
    const s = session(
      '2026-01-05',
      [
        [60, 12],
        [60, 12],
      ],
      { rpe: 8 },
    );
    expect(
      progression([s], { prescription: prescription({ targetRir: null, targetRpe: 8 }) })?.kind,
    ).toBe('load');
  });
  it('ignore les séries d’échauffement', () => {
    const s = session('2026-01-05', [
      [60, 12, 2],
      [60, 12, 2],
    ]);
    s.sets.unshift(set(30, 5, { setType: 'warmup' }));
    expect(progression([s])?.kind).toBe('load');
  });
  it('une série ratée empêche la hausse', () => {
    const s = session('2026-01-05', [
      [60, 12, 2],
      [60, 12, 2],
    ]);
    s.sets[1]!.completed = false;
    expect(progression([s])?.kind).not.toBe('load');
  });
  it('dans la fourchette → garder la charge et viser +1 rep', () => {
    const out = progression([
      session('2026-01-05', [
        [60, 10, 2],
        [60, 9, 2],
        [60, 9, 1],
      ]),
    ]);
    expect(out).toMatchObject({
      kind: 'reps_target',
      currentLoadKg: 60,
      currentMinReps: 9,
      targetReps: 10,
    });
    expect(out?.kind === 'reps_target' && out.hint).toBe(
      'Objectif : 10 reps à 60 kg sur chaque série.',
    );
  });
  it('option : ne pas proposer +1 rep', () => {
    const out = progression(
      [
        session('2026-01-05', [
          [60, 10],
          [60, 9],
        ]),
      ],
      {
        params: { ...dp, suggestRepTarget: false },
      },
    );
    expect(out).toBeNull();
  });
  it('sous la fourchette 2 séances de suite → baisse de 7,5 % arrondie', () => {
    const out = progression([
      session('2026-01-01', [
        [60, 7],
        [60, 6],
        [60, 6],
      ]),
      session('2026-01-03', [
        [60, 6],
        [60, 6],
        [60, 5],
      ]),
    ]);
    expect(out).toMatchObject({
      kind: 'load',
      direction: 'decrease',
      currentLoadKg: 60,
      proposedLoadKg: 55,
    });
    expect(out?.justification).toContain('Garder la charge reste possible');
  });
  it('sous la fourchette une seule fois → pas de baisse', () => {
    const out = progression([
      session('2026-01-01', [
        [60, 9],
        [60, 8],
      ]),
      session('2026-01-03', [
        [60, 6],
        [60, 6],
      ]),
    ]);
    expect(out).toBeNull();
  });
  it('la baisse fait au moins un incrément', () => {
    const out = progression(
      [
        session('2026-01-01', [
          [20, 5],
          [20, 5],
        ]),
        session('2026-01-03', [
          [20, 5],
          [20, 5],
        ]),
      ],
      { incrementKg: 2.5 },
    );
    expect(out).toMatchObject({ proposedLoadKg: 17.5 });
  });
  it('fourchette fixe (5 reps)', () => {
    const out = progression(
      [
        session('2026-01-05', [
          [100, 5, 2],
          [100, 5, 2],
        ]),
      ],
      {
        prescription: prescription({ repsMin: 5, repsMax: 5 }),
      },
    );
    expect(out).toMatchObject({ kind: 'load', proposedLoadKg: 102.5 });
  });
  it('exercice sans charge (poids du corps) : seulement +1 rep', () => {
    const out = progression(
      [
        session('2026-01-05', [
          [null, 12],
          [null, 12],
        ]),
      ],
      {
        loadable: false,
        prescription: prescription({ loadKg: null }),
      },
    );
    expect(out).toBeNull();
    const out2 = progression(
      [
        session('2026-01-05', [
          [null, 10],
          [null, 9],
        ]),
      ],
      {
        loadable: false,
        prescription: prescription({ loadKg: null }),
      },
    );
    expect(out2).toMatchObject({ kind: 'reps_target', targetReps: 10 });
    expect(out2?.kind === 'reps_target' && out2.hint).toBe('Objectif : 10 reps sur chaque série.');
  });
  it('cas limites : pas de fourchette, pas de séance, pas de série', () => {
    expect(
      progression([session('2026-01-05', [[60, 10]])], {
        prescription: prescription({ repsMin: null, repsMax: null }),
      }),
    ).toBeNull();
    expect(progression([])).toBeNull();
    expect(
      progression([
        { sessionId: 'x', date: '2026-01-01', sets: [set(40, 10, { setType: 'warmup' })] },
      ]),
    ).toBeNull();
  });
  it('charge de travail = charge la plus fréquente', () => {
    expect(sessionWorkingLoad([set(60, 10), set(60, 10), set(62.5, 8)])).toBe(60);
    expect(sessionWorkingLoad([])).toBeNull();
  });
});

describe('§8.2 stagnation', () => {
  const params = DEFAULT_PARAMS.stagnation;
  const flat = [
    session('2026-01-01', [[80, 8]]),
    session('2026-01-04', [[80, 8]]),
    session('2026-01-08', [[80, 7]]),
    session('2026-01-11', [[80, 8]]),
  ];
  const alts = [{ id: 'alt', name: 'Développé haltères' }];
  it('3 séances sans progression → alerte + variante proposée', () => {
    const out = evaluateStagnation({
      exerciseName: 'Développé couché',
      sessions: flat,
      prescription: prescription(),
      alternatives: alts,
      params,
    });
    expect(out?.action).toEqual({
      kind: 'variation',
      exerciseId: 'alt',
      exerciseName: 'Développé haltères',
    });
    expect(out?.alertMessage).toContain('aucune progression depuis 3 séances');
    expect(out?.alertMessage).toContain('meilleure performance 80 kg × 8');
    expect(out?.justification).toContain('variante proposée : Développé haltères');
  });
  it('sans alternative → changement de fourchette', () => {
    const out = evaluateStagnation({
      exerciseName: 'X',
      sessions: flat,
      prescription: prescription(),
      alternatives: [],
      params,
    });
    expect(out?.action).toEqual({ kind: 'rep_range', repsMin: 5, repsMax: 8 });
    expect(out?.justification).toContain('8–12 → 5–8');
  });
  it('sans fourchette → décharge', () => {
    const out = evaluateStagnation({
      exerciseName: 'X',
      sessions: flat,
      prescription: null,
      alternatives: [],
      params,
    });
    expect(out?.action).toEqual({ kind: 'deload' });
    const out2 = evaluateStagnation({
      exerciseName: 'X',
      sessions: flat,
      prescription: prescription(),
      alternatives: alts,
      params: { ...params, preferredAction: 'deload' },
    });
    expect(out2?.action.kind).toBe('deload');
  });
  it('une progression de charge OU de reps annule l’alerte', () => {
    const withReps = [...flat.slice(0, 3), session('2026-01-11', [[80, 9]])];
    expect(
      evaluateStagnation({
        exerciseName: 'X',
        sessions: withReps,
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
    const withLoad = [...flat.slice(0, 3), session('2026-01-11', [[82.5, 8]])];
    expect(
      evaluateStagnation({
        exerciseName: 'X',
        sessions: withLoad,
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
  });
  it('pas assez de séances → rien', () => {
    expect(
      evaluateStagnation({
        exerciseName: 'X',
        sessions: flat.slice(0, 3),
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
  });
  it('exercice au poids du corps : compare les reps', () => {
    const bw = [12, 12, 11, 12].map((r, i) => session(`2026-01-0${i + 1}`, [[null, r]]));
    const out = evaluateStagnation({
      exerciseName: 'Tractions',
      sessions: bw,
      prescription: null,
      alternatives: [],
      params,
    });
    expect(out?.unit).toBe('reps');
    expect(out?.alertMessage).toContain('12 reps max');
  });
  it('séance vide ou unités mélangées → rien', () => {
    const mixed = [session('2026-01-01', [[null, 12]]), ...flat.slice(1)];
    expect(
      evaluateStagnation({
        exerciseName: 'X',
        sessions: mixed,
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
    const empty = [...flat.slice(0, 3), { sessionId: 'e', date: '2026-01-12', sets: [] }];
    expect(
      evaluateStagnation({
        exerciseName: 'X',
        sessions: empty,
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
  });
  it('une hausse de charge suivie de reps plus basses n’est PAS une stagnation', () => {
    // 60 × 12 puis +2,5 kg : 62,5 × 8 → 9 → 10 (le 1RM estimé recule, mais on progresse).
    const s = [
      session('2026-01-01', [[60, 12]]),
      session('2026-01-04', [[62.5, 8]]),
      session('2026-01-08', [[62.5, 9]]),
      session('2026-01-11', [[62.5, 10]]),
    ];
    expect(
      evaluateStagnation({
        exerciseName: 'X',
        sessions: s,
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
  });
  it('exercice au temps (sans reps) : pas d’analyse de stagnation', () => {
    const timed = [1, 2, 3, 4].map((i) => session(`2026-01-0${i}`, [[null, null]]));
    expect(
      evaluateStagnation({
        exerciseName: 'Gainage',
        sessions: timed,
        prescription: null,
        alternatives: [],
        params,
      }),
    ).toBeNull();
  });
  it('propose une nouvelle fourchette', () => {
    expect(proposeRepRange(8, 12)).toEqual({ repsMin: 5, repsMax: 8 });
    expect(proposeRepRange(10, 15)).toEqual({ repsMin: 6, repsMax: 10 });
    expect(proposeRepRange(3, 5)).toEqual({ repsMin: 8, repsMax: 12 });
  });
  it('variation de performance de la dernière séance', () => {
    const s = [session('2026-01-01', [[100, 5]]), session('2026-01-03', [[90, 5]])];
    expect(lastSessionChangePercent(s, 3)).toBe(-10);
    expect(lastSessionChangePercent(s.slice(0, 1), 3)).toBeNull();
    expect(
      lastSessionChangePercent(
        [session('2026-01-01', [[null, 5]]), session('2026-01-02', [[90, 5]])],
        3,
      ),
    ).toBeNull();
  });
});

describe('§8.2 fatigue', () => {
  const params = DEFAULT_PARAMS.fatigue;
  const fs = (rating: number | null, rir: number, target = 2): FatigueSession => ({
    sessionId: `f${rating}${rir}`,
    date: '2026-01-01',
    rating,
    sets: [1, 2, 3].map(() => ({ ...set(60, 8, { rir }), targetRir: target })),
  });
  it('ressenti élevé + RIR sous la cible → décharge', () => {
    const out = evaluateFatigue({
      sessions: [fs(9, 0), fs(8, 0), fs(9, 0)],
      performanceChanges: [],
      latestCheckin: null,
      params,
    });
    expect(out?.signals).toHaveLength(2);
    expect(out?.volumeFactor).toBe(0.5);
    expect(out?.justification).toMatch(
      /^Signes de fatigue : ressenti moyen 8,7\/10.*RIR réel inférieur à la cible de 2.*volume −50 %/,
    );
  });
  it('un seul signal ne suffit pas', () => {
    expect(
      evaluateFatigue({
        sessions: [fs(9, 2), fs(9, 2)],
        performanceChanges: [],
        latestCheckin: null,
        params,
      }),
    ).toBeNull();
  });
  it('baisse de performance + bilan bas', () => {
    const out = evaluateFatigue({
      sessions: [fs(5, 2)],
      performanceChanges: [-8, -6, 1],
      latestCheckin: { sleep: 2, energy: 2 },
      params,
    });
    expect(out?.signals).toEqual([
      'performance en baisse sur 2 exercices sur 3',
      'sommeil 2/5 et énergie 2/5 au dernier bilan',
    ]);
  });
  it('baisse sur une minorité d’exercices : pas de signal', () => {
    const out = evaluateFatigue({
      sessions: [],
      performanceChanges: [-8, 2, 3],
      latestCheckin: { sleep: 1, energy: null },
      params,
    });
    expect(out).toBeNull();
  });
  it('calcule les écarts de RIR (séries de travail validées seulement)', () => {
    const sets = [
      { ...set(60, 8, { rir: 0 }), targetRir: 2 },
      { ...set(60, 8, { rir: 0, setType: 'warmup' }), targetRir: 2 },
      { ...set(60, 8, { rpe: 9 }), targetRir: 2 },
      { ...set(60, 8, { rir: null }), targetRir: 2 },
      { ...set(60, 8, { rir: 1 }), targetRir: null },
    ];
    expect(rirDeficits(sets)).toEqual([2, 1]);
  });
});

describe('§8.2 temps de repos', () => {
  const params = DEFAULT_PARAMS.rest_time;
  const rs = (actual: number[], prescribed = 120) => ({
    sessionId: 'r',
    date: '2026-01-01',
    sets: actual.map((a) =>
      set(60, 8, { restSecondsActual: a, restSecondsPrescribed: prescribed }),
    ),
  });
  it('repos très longs de façon répétée → information', () => {
    const out = evaluateRestTime(
      [rs([240, 220, 100]), rs([90, 100, 110]), rs([200, 210, 230])],
      params,
    );
    expect(out?.sessionsConcerned).toBe(2);
    expect(out?.justification).toBe(
      'Repos réels nettement plus longs que prévu sur 2 des 3 dernières séances (3 min 40 en moyenne au lieu de 2 min). Information uniquement.',
    );
  });
  it('une seule séance concernée → rien', () => {
    expect(evaluateRestTime([rs([240, 240]), rs([120, 120])], params)).toBeNull();
  });
  it('ignore les séries sans mesure', () => {
    expect(
      evaluateRestTime([{ sessionId: 'x', date: '2026-01-01', sets: [set(60, 8)] }], params),
    ).toBeNull();
  });
  it('dépassement trop faible en secondes → pas concerné', () => {
    expect(evaluateRestTime([rs([50, 50], 30), rs([50, 50], 30)], params)).toBeNull();
  });
});
