import { evaluateDoubleProgression } from './doubleProgression.ts';
import { evaluateFatigue, type FatigueSession } from './fatigue.ts';
import { evaluateRestTime } from './restTime.ts';
import { resolveRule, type RuleKey, type RuleRow } from './rules.ts';
import { evaluateStagnation, lastSessionChangePercent } from './stagnation.ts';
import type { ExerciseSession, Prescription } from '../types.ts';

/**
 * MOTEUR DE SUGGESTIONS
 * ---------------------
 * Appelé après chaque séance terminée (côté serveur). Il combine toutes les règles
 * et produit des « brouillons » de suggestions et d'alertes. Rien n'est appliqué ici :
 * c'est le coach qui valide (sauf règle en application automatique).
 */

export type SuggestionKind = 'load' | 'reps_target' | 'deload' | 'variation' | 'rep_range' | 'info';
export type AlertType = 'stagnation' | 'high_fatigue' | 'long_rest';

export type SuggestionDraft = {
  kind: SuggestionKind;
  ruleKey: RuleKey;
  exerciseId: string | null;
  programId: string | null;
  currentValue: Record<string, unknown>;
  proposedValue: Record<string, unknown>;
  justification: string;
  /** Une seule suggestion en attente par clé : une nouvelle remplace l'ancienne. */
  dedupeKey: string;
  autoApply: boolean;
};

export type AlertDraft = {
  type: AlertType;
  message: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
};

export type EngineExercise = {
  exerciseId: string;
  name: string;
  incrementKg: number;
  loadable: boolean;
  /** Prescription des séries de travail de la PROCHAINE séance contenant l'exercice (null si plus prévu). */
  prescription: Prescription | null;
  alternatives: readonly { id: string; name: string }[];
  /** Historique de l'exercice (plus ancienne → plus récente), séance qui vient d'être faite incluse. */
  history: readonly ExerciseSession[];
};

export type EngineInput = {
  adherentId: string;
  programId: string | null;
  sessionId: string;
  /** Lundi de la semaine en cours (AAAA-MM-JJ), pour dédoublonner les alertes hebdo. */
  weekStart: string;
  /** Prochaine semaine du programme (cible d'une éventuelle décharge), null si aucune. */
  nextWeekIndex: number | null;
  /** Exercices réalisés pendant la séance qui vient de se terminer. */
  exercises: readonly EngineExercise[];
  /** Séances récentes de l'adhérent (toutes séances confondues), pour la fatigue et le repos. */
  recentSessions: readonly FatigueSession[];
  latestCheckin: { sleep: number | null; energy: number | null } | null;
  rules: readonly RuleRow[];
};

export type EngineOutput = { suggestions: SuggestionDraft[]; alerts: AlertDraft[] };

export function runEngine(input: EngineInput): EngineOutput {
  const suggestions: SuggestionDraft[] = [];
  const alerts: AlertDraft[] = [];
  const { adherentId, programId } = input;
  let deloadProposed = false;

  for (const ex of input.exercises) {
    // --- Stagnation (prioritaire : si l'exercice stagne, inutile de proposer +1 rep) ---
    const stag = resolveRule('stagnation', input.rules, adherentId, ex.exerciseId);
    let stagnating = false;
    if (stag.enabled) {
      const outcome = evaluateStagnation({
        exerciseName: ex.name,
        sessions: ex.history,
        prescription: ex.prescription,
        alternatives: ex.alternatives,
        params: stag.params,
      });
      if (outcome) {
        stagnating = true;
        alerts.push({
          type: 'stagnation',
          message: outcome.alertMessage,
          payload: { exercise_id: ex.exerciseId, session_id: input.sessionId },
          dedupeKey: `stagnation:${adherentId}:${ex.exerciseId}:${input.sessionId}`,
        });
        const base = {
          ruleKey: 'stagnation' as const,
          exerciseId: ex.exerciseId,
          programId,
          justification: outcome.justification,
          dedupeKey: `stagnation:${adherentId}:${ex.exerciseId}`,
          autoApply: stag.autoApply,
        };
        if (outcome.action.kind === 'variation') {
          suggestions.push({
            ...base,
            kind: 'variation',
            currentValue: { exercise_id: ex.exerciseId, exercise_name: ex.name },
            proposedValue: {
              exercise_id: outcome.action.exerciseId,
              exercise_name: outcome.action.exerciseName,
            },
          });
        } else if (outcome.action.kind === 'rep_range') {
          suggestions.push({
            ...base,
            kind: 'rep_range',
            currentValue: {
              reps_min: ex.prescription?.repsMin ?? null,
              reps_max: ex.prescription?.repsMax ?? null,
            },
            proposedValue: { reps_min: outcome.action.repsMin, reps_max: outcome.action.repsMax },
          });
        } else if (input.nextWeekIndex !== null && !deloadProposed) {
          deloadProposed = true;
          suggestions.push({
            ...base,
            kind: 'deload',
            exerciseId: null,
            dedupeKey: `deload:${adherentId}:${programId}:${input.nextWeekIndex}`,
            currentValue: { volume_factor: 1 },
            proposedValue: { week_index: input.nextWeekIndex, volume_factor: 0.5, load_factor: 1 },
          });
        }
      }
    }

    // --- Double progression ---
    const dp = resolveRule('double_progression', input.rules, adherentId, ex.exerciseId);
    if (dp.enabled && ex.prescription && !stagnating) {
      const outcome = evaluateDoubleProgression({
        exerciseName: ex.name,
        incrementKg: ex.incrementKg,
        loadable: ex.loadable,
        prescription: ex.prescription,
        sessions: ex.history,
        params: dp.params,
      });
      if (outcome?.kind === 'load') {
        suggestions.push({
          kind: 'load',
          ruleKey: 'double_progression',
          exerciseId: ex.exerciseId,
          programId,
          currentValue: { load_kg: outcome.currentLoadKg },
          proposedValue: { load_kg: outcome.proposedLoadKg },
          justification: `${ex.name} : ${outcome.justification}`,
          dedupeKey: `progression:${adherentId}:${ex.exerciseId}`,
          autoApply: dp.autoApply,
        });
      } else if (outcome?.kind === 'reps_target') {
        suggestions.push({
          kind: 'reps_target',
          ruleKey: 'double_progression',
          exerciseId: ex.exerciseId,
          programId,
          currentValue: { reps: outcome.currentMinReps, load_kg: outcome.currentLoadKg },
          proposedValue: {
            reps: outcome.targetReps,
            load_kg: outcome.currentLoadKg,
            hint: outcome.hint,
          },
          justification: `${ex.name} : ${outcome.justification}`,
          dedupeKey: `progression:${adherentId}:${ex.exerciseId}`,
          autoApply: dp.autoApply,
        });
      }
    }
  }

  // --- Fatigue (au niveau de l'adhérent) ---
  const fat = resolveRule('fatigue', input.rules, adherentId);
  if (fat.enabled) {
    const changes = input.exercises
      .map((ex) => lastSessionChangePercent(ex.history, fat.params.lookbackSessions))
      .filter((c): c is number => c !== null);
    const outcome = evaluateFatigue({
      sessions: input.recentSessions,
      performanceChanges: changes,
      latestCheckin: input.latestCheckin,
      params: fat.params,
    });
    if (outcome) {
      alerts.push({
        type: 'high_fatigue',
        message: outcome.justification,
        payload: { signals: outcome.signals },
        dedupeKey: `fatigue:${adherentId}:${input.weekStart}`,
      });
      if (input.nextWeekIndex !== null && !deloadProposed) {
        deloadProposed = true;
        suggestions.push({
          kind: 'deload',
          ruleKey: 'fatigue',
          exerciseId: null,
          programId,
          currentValue: { volume_factor: 1 },
          proposedValue: {
            week_index: input.nextWeekIndex,
            volume_factor: outcome.volumeFactor,
            load_factor: 1,
          },
          justification: outcome.justification,
          dedupeKey: `deload:${adherentId}:${programId}:${input.nextWeekIndex}`,
          autoApply: fat.autoApply,
        });
      }
    }
  }

  // --- Temps de repos ---
  const rest = resolveRule('rest_time', input.rules, adherentId);
  if (rest.enabled) {
    const outcome = evaluateRestTime(input.recentSessions, rest.params);
    if (outcome) {
      alerts.push({
        type: 'long_rest',
        message: outcome.justification,
        payload: {
          avg_actual_seconds: outcome.avgActualSeconds,
          avg_prescribed_seconds: outcome.avgPrescribedSeconds,
        },
        dedupeKey: `rest:${adherentId}:${input.weekStart}`,
      });
      suggestions.push({
        kind: 'info',
        ruleKey: 'rest_time',
        exerciseId: null,
        programId,
        currentValue: { avg_prescribed_seconds: outcome.avgPrescribedSeconds },
        proposedValue: { avg_actual_seconds: outcome.avgActualSeconds },
        justification: outcome.justification,
        dedupeKey: `rest:${adherentId}`,
        autoApply: false,
      });
    }
  }

  return { suggestions, alerts };
}
