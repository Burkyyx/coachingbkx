import { runEngine, type EngineExercise, type EngineInput } from '../algorithms/engine';
import type { RuleRow } from '../algorithms/rules';
import {
  actualRestSeconds,
  applyVolumeFactor,
  planExerciseSets,
  prefillSet,
  resolveTargetLoad,
  type PrescribedSetInput,
} from '../session/plan';
import { summarizeSession } from '../session/summary';
import { prescription, session, set } from '../testing/factories';

function exercise(over: Partial<EngineExercise> = {}): EngineExercise {
  return {
    exerciseId: 'bench',
    name: 'Développé couché',
    incrementKg: 2.5,
    loadable: true,
    prescription: prescription(),
    alternatives: [],
    history: [
      session('2026-01-05', [
        [60, 12, 2],
        [60, 12, 2],
      ]),
    ],
    ...over,
  };
}

function input(over: Partial<EngineInput> = {}): EngineInput {
  return {
    adherentId: 'a1',
    programId: 'p1',
    sessionId: 'sess1',
    weekStart: '2026-01-05',
    nextWeekIndex: 3,
    exercises: [exercise()],
    recentSessions: [],
    latestCheckin: null,
    rules: [],
    ...over,
  };
}

describe('moteur de suggestions', () => {
  it('produit une suggestion de charge avec justification et clé de dédoublonnage', () => {
    const out = runEngine(input());
    expect(out.alerts).toEqual([]);
    expect(out.suggestions).toEqual([
      expect.objectContaining({
        kind: 'load',
        ruleKey: 'double_progression',
        exerciseId: 'bench',
        programId: 'p1',
        currentValue: { load_kg: 60 },
        proposedValue: { load_kg: 62.5 },
        dedupeKey: 'progression:a1:bench',
        autoApply: false,
      }),
    ]);
    expect(out.suggestions[0]?.justification).toMatch(/^Développé couché : Dernière séance/);
  });

  it('propose +1 rep quand les reps sont dans la fourchette', () => {
    const out = runEngine(
      input({
        exercises: [
          exercise({
            history: [
              session('2026-01-05', [
                [60, 9],
                [60, 10],
              ]),
            ],
          }),
        ],
      }),
    );
    expect(out.suggestions[0]).toMatchObject({
      kind: 'reps_target',
      proposedValue: {
        reps: 10,
        load_kg: 60,
        hint: 'Objectif : 10 reps à 60 kg sur chaque série.',
      },
    });
  });

  it('respecte une règle désactivée et l’application automatique', () => {
    const disabled: RuleRow[] = [
      {
        ruleKey: 'double_progression',
        adherentId: 'a1',
        exerciseId: null,
        params: {},
        enabled: false,
        autoApply: false,
      },
    ];
    expect(runEngine(input({ rules: disabled })).suggestions).toEqual([]);
    const auto: RuleRow[] = [
      {
        ruleKey: 'double_progression',
        adherentId: null,
        exerciseId: null,
        params: {},
        enabled: true,
        autoApply: true,
      },
    ];
    expect(runEngine(input({ rules: auto })).suggestions[0]?.autoApply).toBe(true);
  });

  it('pas de suggestion de progression si l’exercice n’est plus prévu', () => {
    expect(runEngine(input({ exercises: [exercise({ prescription: null })] })).suggestions).toEqual(
      [],
    );
  });

  it('stagnation : alerte + variante, et pas de « +1 rep » en plus', () => {
    const history = [
      session('2026-01-01', [
        [80, 8],
        [80, 8],
      ]),
      session('2026-01-04', [
        [80, 8],
        [80, 8],
      ]),
      session('2026-01-08', [
        [80, 8],
        [80, 7],
      ]),
      session('2026-01-11', [
        [80, 8],
        [80, 8],
      ]),
    ];
    const out = runEngine(
      input({
        exercises: [
          exercise({ history, alternatives: [{ id: 'db', name: 'Développé haltères' }] }),
        ],
      }),
    );
    expect(out.alerts).toEqual([
      expect.objectContaining({ type: 'stagnation', dedupeKey: 'stagnation:a1:bench:sess1' }),
    ]);
    expect(out.suggestions).toHaveLength(1);
    expect(out.suggestions[0]).toMatchObject({
      kind: 'variation',
      proposedValue: { exercise_id: 'db', exercise_name: 'Développé haltères' },
      dedupeKey: 'stagnation:a1:bench',
    });
  });

  it('stagnation : changement de fourchette ou décharge selon le réglage', () => {
    const history = [
      session('2026-01-01', [[80, 8]]),
      session('2026-01-04', [[80, 8]]),
      session('2026-01-08', [[80, 8]]),
      session('2026-01-11', [[80, 8]]),
    ];
    const range = runEngine(input({ exercises: [exercise({ history })] }));
    expect(range.suggestions[0]).toMatchObject({
      kind: 'rep_range',
      proposedValue: { reps_min: 5, reps_max: 8 },
    });

    const rules: RuleRow[] = [
      {
        ruleKey: 'stagnation',
        adherentId: null,
        exerciseId: null,
        params: { preferredAction: 'deload' },
        enabled: true,
        autoApply: false,
      },
    ];
    const deload = runEngine(
      input({
        rules,
        exercises: [exercise({ history }), exercise({ exerciseId: 'squat', history })],
      }),
    );
    // Une seule décharge même si deux exercices stagnent.
    expect(deload.suggestions.filter((s) => s.kind === 'deload')).toHaveLength(1);
    expect(deload.suggestions[0]).toMatchObject({
      kind: 'deload',
      exerciseId: null,
      proposedValue: { week_index: 3, volume_factor: 0.5, load_factor: 1 },
    });
    // Pas de semaine suivante → pas de décharge proposée (l'alerte reste).
    const none = runEngine(
      input({ rules, nextWeekIndex: null, exercises: [exercise({ history })] }),
    );
    expect(none.suggestions).toEqual([]);
    expect(none.alerts).toHaveLength(1);
  });

  it('fatigue : alerte + décharge pour la semaine suivante', () => {
    const tired = (id: string) => ({
      sessionId: id,
      date: '2026-01-05',
      rating: 9,
      sets: [set(60, 8, { rir: 0 }), set(60, 8, { rir: 0 })].map((s) => ({ ...s, targetRir: 2 })),
    });
    const out = runEngine(
      input({
        exercises: [exercise({ prescription: null })],
        recentSessions: [tired('x'), tired('y'), tired('z')],
      }),
    );
    expect(out.alerts[0]).toMatchObject({
      type: 'high_fatigue',
      dedupeKey: 'fatigue:a1:2026-01-05',
    });
    expect(out.suggestions[0]).toMatchObject({
      kind: 'deload',
      ruleKey: 'fatigue',
      proposedValue: { week_index: 3, volume_factor: 0.5 },
      dedupeKey: 'deload:a1:p1:3',
    });
  });

  it('temps de repos : information au coach (jamais appliquée automatiquement)', () => {
    const slow = (id: string) => ({
      sessionId: id,
      date: '2026-01-05',
      rating: null,
      sets: [set(60, 8, { restSecondsActual: 300, restSecondsPrescribed: 90 })].map((s) => ({
        ...s,
        targetRir: null,
      })),
    });
    const rules: RuleRow[] = [
      {
        ruleKey: 'rest_time',
        adherentId: null,
        exerciseId: null,
        params: {},
        enabled: true,
        autoApply: true,
      },
    ];
    const out = runEngine(input({ rules, exercises: [], recentSessions: [slow('a'), slow('b')] }));
    expect(out.alerts[0]?.type).toBe('long_rest');
    expect(out.suggestions[0]).toMatchObject({
      kind: 'info',
      autoApply: false,
      dedupeKey: 'rest:a1',
    });
  });

  it('règles de fatigue et de repos désactivées', () => {
    const rules: RuleRow[] = (['fatigue', 'rest_time', 'stagnation'] as const).map((ruleKey) => ({
      ruleKey,
      adherentId: null,
      exerciseId: null,
      params: {},
      enabled: false,
      autoApply: false,
    }));
    const slow = {
      sessionId: 'a',
      date: '2026-01-05',
      rating: 10,
      sets: [
        {
          ...set(60, 8, { rir: 0, restSecondsActual: 300, restSecondsPrescribed: 90 }),
          targetRir: 3,
        },
      ],
    };
    const out = runEngine(input({ rules, exercises: [], recentSessions: [slow, slow, slow] }));
    expect(out).toEqual({ suggestions: [], alerts: [] });
  });
});

describe('préparation de la séance', () => {
  const ps = (over: Partial<PrescribedSetInput>): PrescribedSetInput => ({
    id: 'ps',
    position: 0,
    setType: 'working',
    repsMin: 8,
    repsMax: 12,
    loadKg: 60,
    loadPct1rm: null,
    targetRir: 2,
    targetRpe: null,
    restSeconds: 120,
    tempo: null,
    durationSeconds: null,
    ...over,
  });

  it('calcule la charge en % du 1RM fourni par le coach', () => {
    expect(resolveTargetLoad({ loadKg: null, loadPct1rm: 75 }, 100, 2.5)).toEqual({
      loadKg: 75,
      missingReference1rm: false,
    });
    expect(resolveTargetLoad({ loadKg: null, loadPct1rm: 72 }, 100, 2.5).loadKg).toBe(72.5);
    expect(resolveTargetLoad({ loadKg: null, loadPct1rm: 75 }, null, 2.5)).toEqual({
      loadKg: null,
      missingReference1rm: true,
    });
    expect(resolveTargetLoad({ loadKg: 60, loadPct1rm: null }, null, 2.5, 0.9).loadKg).toBe(55);
    expect(resolveTargetLoad({ loadKg: null, loadPct1rm: null }, 100, 2.5).loadKg).toBeNull();
  });

  it('décharge : garde l’échauffement et une partie des séries de travail', () => {
    const sets = [
      ps({ id: 'w', setType: 'warmup' }),
      ps({ id: 'a' }),
      ps({ id: 'b' }),
      ps({ id: 'c' }),
      ps({ id: 'd' }),
    ];
    expect(applyVolumeFactor(sets, 0.5).map((s) => s.id)).toEqual(['w', 'a', 'b']);
    expect(applyVolumeFactor([ps({ id: 'a' })], 0.5).map((s) => s.id)).toEqual(['a']);
    expect(applyVolumeFactor(sets, 1)).toHaveLength(5);
  });

  it('planifie les séries triées avec charges cibles', () => {
    const plan = planExerciseSets(
      [ps({ id: 'b', position: 1, loadKg: 62.5 }), ps({ id: 'a', position: 0 })],
      {
        reference1rmKg: null,
        incrementKg: 2.5,
        adjustment: null,
      },
    );
    expect(plan.map((p) => [p.id, p.targetLoadKg])).toEqual([
      ['a', 60],
      ['b', 62.5],
    ]);
  });

  it('pré-remplit avec la cible du coach ou la dernière performance', () => {
    const [planned] = planExerciseSets([ps({})], {
      reference1rmKg: null,
      incrementKg: 2.5,
      adjustment: null,
    });
    expect(prefillSet(planned!, { loadKg: 60, reps: 10 })).toEqual({
      loadKg: 60,
      reps: 10,
      source: 'target',
    });
    // Le coach a augmenté la charge : on part du bas de la fourchette.
    expect(prefillSet(planned!, { loadKg: 57.5, reps: 12 })).toEqual({
      loadKg: 60,
      reps: 8,
      source: 'target',
    });
    const [noTarget] = planExerciseSets([ps({ loadKg: null })], {
      reference1rmKg: null,
      incrementKg: 2.5,
      adjustment: null,
    });
    expect(prefillSet(noTarget!, { loadKg: 40, reps: 11 })).toEqual({
      loadKg: 40,
      reps: 11,
      source: 'last',
    });
    expect(prefillSet(noTarget!, { loadKg: 40, reps: null })).toEqual({
      loadKg: 40,
      reps: 8,
      source: 'last',
    });
    expect(prefillSet(noTarget!, null)).toEqual({ loadKg: null, reps: 8, source: 'none' });
  });

  it('mesure le repos réel (plafonné à 1 h)', () => {
    expect(actualRestSeconds(0, 125_400)).toBe(125);
    expect(actualRestSeconds(0, 10_000_000)).toBe(3600);
    expect(actualRestSeconds(5000, 0)).toBe(0);
  });

  it('résume la séance', () => {
    const sets = [
      set(40, 10, { setType: 'warmup' }),
      set(60, 10),
      set(60, 8),
      set(60, 3, { completed: false }),
    ];
    expect(summarizeSession(0, 3_600_000, sets)).toEqual({
      durationSeconds: 3600,
      completedSets: 2,
      totalReps: 18,
      totalVolumeKg: 1080,
    });
  });
});
