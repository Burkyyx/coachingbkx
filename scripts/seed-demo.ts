/**
 * DONNÉES DE DÉMONSTRATION
 * ------------------------
 * 1 coach + 5 adhérents fictifs + 2 mois d'historique réaliste (séances, séries,
 * repos, records, pesées, bilans, messages), puis analyse par les algorithmes
 * (suggestions et alertes dans la file du coach).
 *
 * Lancement (Supabase local démarré) :
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run seed:demo
 * Comptes créés (mot de passe : motdepasse123) :
 *   coach@demo.fr, julie@demo.fr, thomas@demo.fr, sarah@demo.fr, karim@demo.fr, lea@demo.fr
 *
 * Par sécurité, le script refuse de tourner sur un projet distant sans --remote.
 */
import { createClient } from '@supabase/supabase-js';

import {
  addDays,
  detectSetRecord,
  roundToStep,
  weekStart,
  workoutDate,
  type LoggedSet,
} from '../src/core/index.ts';
import { analyzePending } from '../supabase/functions/compute-suggestions/analyze.ts';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY manquante (voir `npx supabase status`).');
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(URL) && !process.argv.includes('--remote')) {
  console.error(
    'Projet distant détecté : ajouter --remote pour confirmer (déconseillé en production).',
  );
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = 'motdepasse123';

// Générateur pseudo-aléatoire reproductible.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T;
const between = (min: number, max: number) => min + rand() * (max - min);
const uuid = () => crypto.randomUUID();

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what} : ${JSON.stringify(error)}`);
  return data;
}

async function insertMany(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    await must(db.from(table).insert(rows.slice(i, i + 500)), `insertion ${table}`);
  }
}

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------
type Persona = {
  key: string;
  first: string;
  last: string;
  sex: 'male' | 'female';
  birth: string;
  height: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  goal: 'muscle_gain' | 'fat_loss' | 'recomposition' | 'performance' | 'health';
  template: 'ppl' | 'fullbody';
  attendance: number;
  strength: number;
  weight: number;
  weeklyWeightChange: number;
  restFactor: number;
  injuries: string | null;
  scale: 'rir' | 'rpe';
};

const PERSONAS: Persona[] = [
  {
    key: 'julie',
    first: 'Julie',
    last: 'Martin',
    sex: 'female',
    birth: '1994-03-14',
    height: 168,
    level: 'intermediate',
    goal: 'recomposition',
    template: 'ppl',
    attendance: 0.92,
    strength: 0.65,
    weight: 63,
    weeklyWeightChange: -0.1,
    restFactor: 1,
    injuries: null,
    scale: 'rir',
  },
  {
    key: 'thomas',
    first: 'Thomas',
    last: 'Bernard',
    sex: 'male',
    birth: '1999-07-02',
    height: 181,
    level: 'beginner',
    goal: 'muscle_gain',
    template: 'fullbody',
    attendance: 0.95,
    strength: 0.8,
    weight: 72,
    weeklyWeightChange: 0.2,
    restFactor: 1.9,
    injuries: null,
    scale: 'rir',
  },
  {
    key: 'sarah',
    first: 'Sarah',
    last: 'Petit',
    sex: 'female',
    birth: '1990-11-23',
    height: 164,
    level: 'intermediate',
    goal: 'fat_loss',
    template: 'ppl',
    attendance: 0.8,
    strength: 0.6,
    weight: 71,
    weeklyWeightChange: -0.35,
    restFactor: 1.1,
    injuries: 'Tendinite épaule droite l’an dernier : éviter le développé militaire lourd.',
    scale: 'rpe',
  },
  {
    key: 'karim',
    first: 'Karim',
    last: 'Haddad',
    sex: 'male',
    birth: '1987-05-09',
    height: 176,
    level: 'advanced',
    goal: 'performance',
    template: 'ppl',
    attendance: 0.9,
    strength: 1.25,
    weight: 84,
    weeklyWeightChange: 0.05,
    restFactor: 1.05,
    injuries: null,
    scale: 'rir',
  },
  {
    key: 'lea',
    first: 'Léa',
    last: 'Moreau',
    sex: 'female',
    birth: '2001-01-30',
    height: 159,
    level: 'beginner',
    goal: 'health',
    template: 'fullbody',
    attendance: 0.65,
    strength: 0.5,
    weight: 55,
    weeklyWeightChange: 0,
    restFactor: 1,
    injuries: 'Lombalgie chronique légère.',
    scale: 'rir',
  },
];

async function deleteDemoUsers() {
  const emails = new Set(['coach@demo.fr', ...PERSONAS.map((p) => `${p.key}@demo.fr`)]);
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (!data.users.length) break;
    for (const u of data.users)
      if (u.email && emails.has(u.email)) await db.auth.admin.deleteUser(u.id);
  }
}

async function createUser(email: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`compte ${email} : ${error?.message ?? 'inconnu'}`);
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------
type SetSpec = {
  type: 'warmup' | 'working';
  min: number;
  max: number;
  rir: number;
  rest: number;
  pct?: number;
};
type ExSpec = { name: string; base: number; sets: SetSpec[]; group?: string; notes?: string };
type WorkoutSpec = { name: string; day: number; exercises: ExSpec[] };

const work = (n: number, min: number, max: number, rest: number, rir = 2): SetSpec[] =>
  Array.from({ length: n }, () => ({ type: 'working', min, max, rir, rest }));
const warm = (min = 10): SetSpec => ({ type: 'warmup', min, max: min, rir: 5, rest: 60 });

const TEMPLATES: Record<
  Persona['template'],
  { name: string; description: string; workouts: WorkoutSpec[] }
> = {
  ppl: {
    name: 'PPL intermédiaire',
    description: 'Push / Pull / Legs, 3 séances par semaine, double progression.',
    workouts: [
      {
        name: 'Push',
        day: 1,
        exercises: [
          {
            name: 'Développé couché barre',
            base: 60,
            sets: [warm(), ...work(4, 6, 10, 150)],
            notes: 'Omoplates serrées, pause d’une seconde en bas.',
          },
          { name: 'Développé incliné haltères', base: 22, sets: work(3, 8, 12, 120) },
          { name: 'Élévations latérales haltères', base: 8, sets: work(3, 12, 15, 60), group: 'A' },
          {
            name: 'Extension triceps poulie haute',
            base: 25,
            sets: work(3, 10, 15, 60),
            group: 'A',
          },
        ],
      },
      {
        name: 'Pull',
        day: 3,
        exercises: [
          { name: 'Tirage vertical poulie haute', base: 55, sets: work(4, 8, 12, 120) },
          { name: 'Rowing barre', base: 50, sets: work(3, 8, 12, 120) },
          { name: 'Face pull', base: 20, sets: work(3, 12, 15, 60) },
          { name: 'Curl haltères', base: 12, sets: work(3, 10, 12, 60) },
        ],
      },
      {
        name: 'Legs',
        day: 5,
        exercises: [
          { name: 'Squat barre', base: 80, sets: [warm(8), ...work(4, 5, 8, 180)] },
          { name: 'Soulevé de terre roumain', base: 70, sets: work(3, 8, 10, 150) },
          { name: 'Presse à cuisses', base: 140, sets: work(3, 10, 12, 120) },
          { name: 'Mollets debout à la machine', base: 60, sets: work(3, 12, 15, 60) },
        ],
      },
    ],
  },
  fullbody: {
    name: 'Full body débutant',
    description: 'Deux séances complètes par semaine pour apprendre les mouvements de base.',
    workouts: [
      {
        name: 'Full body A',
        day: 1,
        exercises: [
          { name: 'Goblet squat', base: 20, sets: work(3, 10, 12, 90) },
          { name: 'Développé couché haltères', base: 18, sets: work(3, 10, 12, 90) },
          { name: 'Tirage horizontal poulie basse', base: 45, sets: work(3, 10, 12, 90) },
          {
            name: 'Gainage planche',
            base: 0,
            sets: [{ type: 'working', min: 1, max: 1, rir: 2, rest: 60 }],
          },
        ],
      },
      {
        name: 'Full body B',
        day: 4,
        exercises: [
          { name: 'Presse à cuisses', base: 100, sets: work(3, 10, 12, 90) },
          { name: 'Développé épaules haltères', base: 12, sets: work(3, 10, 12, 90) },
          { name: 'Rowing haltère un bras', base: 18, sets: work(3, 10, 12, 90) },
          { name: 'Hip thrust barre', base: 50, sets: work(3, 10, 12, 90) },
        ],
      },
    ],
  },
};

const WEEKS = 10;
const HISTORY_WEEKS = 8;

type BuiltExercise = {
  weId: string;
  exerciseId: string;
  spec: ExSpec;
  increment: number;
  setIds: string[];
};
type BuiltWorkout = {
  id: string;
  week: number;
  day: number;
  name: string;
  exercises: BuiltExercise[];
};

async function buildProgram(args: {
  kind: 'template' | 'assigned';
  tpl: (typeof TEMPLATES)[keyof typeof TEMPLATES];
  exercises: Map<string, { id: string; load_increment_kg: number }>;
  adherentId?: string;
  start?: string;
  strength?: number;
}): Promise<{ programId: string; workouts: BuiltWorkout[] }> {
  const programId = uuid();
  await must(
    db.from('programs').insert({
      id: programId,
      kind: args.kind,
      name: args.tpl.name,
      description: args.tpl.description,
      adherent_id: args.adherentId ?? null,
      start_date: args.start ?? null,
      duration_weeks: WEEKS,
      status: args.kind === 'template' ? 'draft' : 'active',
    }),
    'programme',
  );
  const workouts: BuiltWorkout[] = [];
  const wRows: Record<string, unknown>[] = [];
  const weRows: Record<string, unknown>[] = [];
  const psRows: Record<string, unknown>[] = [];
  for (let week = 1; week <= WEEKS; week++) {
    for (const [pos, w] of args.tpl.workouts.entries()) {
      const wid = uuid();
      wRows.push({
        id: wid,
        program_id: programId,
        week_index: week,
        day_of_week: w.day,
        name: w.name,
        position: pos,
      });
      const built: BuiltWorkout = { id: wid, week, day: w.day, name: w.name, exercises: [] };
      for (const [i, ex] of w.exercises.entries()) {
        const lib = args.exercises.get(ex.name);
        if (!lib) throw new Error(`Exercice introuvable : ${ex.name}`);
        const weId = uuid();
        weRows.push({
          id: weId,
          workout_id: wid,
          program_id: programId,
          exercise_id: lib.id,
          position: i,
          superset_group: ex.group ?? null,
          coach_notes: ex.notes ?? null,
        });
        const increment = Number(lib.load_increment_kg);
        const startLoad =
          ex.base > 0 ? roundToStep(ex.base * (args.strength ?? 1), increment) : null;
        const setIds: string[] = [];
        for (const [j, s] of ex.sets.entries()) {
          const id = uuid();
          setIds.push(id);
          psRows.push({
            id,
            workout_exercise_id: weId,
            program_id: programId,
            position: j,
            set_type: s.type,
            reps_min: ex.name === 'Gainage planche' ? null : s.min,
            reps_max: ex.name === 'Gainage planche' ? null : s.max,
            duration_seconds: ex.name === 'Gainage planche' ? 45 : null,
            load_kg:
              startLoad === null
                ? null
                : s.type === 'warmup'
                  ? roundToStep(startLoad * 0.5, increment)
                  : startLoad,
            target_rir: s.type === 'warmup' ? null : s.rir,
            rest_seconds: s.rest,
          });
        }
        built.exercises.push({ weId, exerciseId: lib.id, spec: ex, increment, setIds });
      }
      workouts.push(built);
    }
  }
  await insertMany('workouts', wRows);
  await insertMany('workout_exercises', weRows);
  await insertMany('prescribed_sets', psRows);
  return { programId, workouts };
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------
async function main() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const start = addDays(weekStart(today), -HISTORY_WEEKS * 7);
  console.warn(`▶ Données de démo (programmes démarrés le ${start})`);

  await deleteDemoUsers();
  const library = await must(
    db.from('exercises').select('id, name, load_increment_kg'),
    'bibliothèque',
  );
  const exercises = new Map((library ?? []).map((e) => [e.name, e]));

  // Coach : on réutilise un coach existant, sinon coach@demo.fr.
  const existingCoach = await must(
    db.from('profiles').select('id').eq('role', 'coach').maybeSingle(),
    'coach',
  );
  let coachId = existingCoach?.id as string | undefined;
  if (!coachId) {
    coachId = await createUser('coach@demo.fr');
    await must(
      db.from('profiles').insert({
        id: coachId,
        role: 'coach',
        first_name: 'Enzo',
        last_name: 'Coach',
        onboarded_at: new Date().toISOString(),
      }),
      'profil coach',
    );
  }

  // Modèles réutilisables (pour le constructeur).
  for (const tpl of Object.values(TEMPLATES))
    await buildProgram({ kind: 'template', tpl, exercises });

  for (const persona of PERSONAS) {
    const uid = await createUser(`${persona.key}@demo.fr`);
    const createdAt = addDays(start, -3);
    await must(
      db.from('profiles').insert({
        id: uid,
        role: 'adherent',
        first_name: persona.first,
        last_name: persona.last,
        nickname: persona.first.toLowerCase(),
        birth_date: persona.birth,
        sex: persona.sex,
        height_cm: persona.height,
        level: persona.level,
        goal: persona.goal,
        injuries: persona.injuries,
        effort_scale: persona.scale,
        onboarded_at: `${createdAt}T10:00:00Z`,
        created_at: `${createdAt}T10:00:00Z`,
      }),
      `profil ${persona.first}`,
    );
    await insertMany('consents', [
      { user_id: uid, type: 'terms', version: '1.0', granted_at: `${createdAt}T10:00:00Z` },
      { user_id: uid, type: 'training_data', version: '1.0', granted_at: `${createdAt}T10:00:00Z` },
      { user_id: uid, type: 'health_data', version: '1.0', granted_at: `${createdAt}T10:00:00Z` },
    ]);

    const { programId, workouts } = await buildProgram({
      kind: 'assigned',
      tpl: TEMPLATES[persona.template],
      exercises,
      adherentId: uid,
      start,
      strength: persona.strength,
    });

    // État de progression par exercice (double progression simulée).
    const state = new Map<string, { load: number | null; reps: number }>();
    const priorSets = new Map<string, LoggedSet[]>();
    const sessions: Record<string, unknown>[] = [];
    const sets: Record<string, unknown>[] = [];
    const records: Record<string, unknown>[] = [];
    const lastActive = persona.key === 'lea' ? addDays(today, -10) : today;

    for (const w of workouts) {
      const date = workoutDate(start, w.week, w.day);
      if (date >= today || date > lastActive) continue;
      if (rand() > persona.attendance) continue;
      const sessionId = uuid();
      const recentWeeks = w.week >= HISTORY_WEEKS - 1;
      // Sarah : fatigue en fin de période (séances dures, RIR trop bas).
      const tired = persona.key === 'sarah' && recentWeeks;
      const startedAt = new Date(
        `${date}T${String(17 + Math.floor(rand() * 3)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00Z`,
      );
      let clock = startedAt.getTime();

      for (const ex of w.exercises) {
        const key = ex.exerciseId;
        const working = ex.spec.sets.filter((s) => s.type === 'working');
        const min = working[0]?.min ?? 8;
        const max = working[0]?.max ?? 12;
        const base =
          ex.spec.base > 0 ? roundToStep(ex.spec.base * persona.strength, ex.increment) : null;
        const st = state.get(key) ?? { load: base, reps: min };
        // Karim : stagnation au développé couché sur les dernières séances.
        const stagnates =
          persona.key === 'karim' &&
          ex.spec.name === 'Développé couché barre' &&
          w.week >= HISTORY_WEEKS - 3;
        let allTop = true;
        for (const [j, s] of ex.spec.sets.entries()) {
          clock += between(40, 70) * 1000;
          const isWarm = s.type === 'warmup';
          let reps = isWarm
            ? s.min
            : Math.max(
                1,
                Math.round(st.reps + between(-0.5, 0.6) - (j > 1 && rand() < 0.35 ? 1 : 0)),
              );
          if (stagnates) reps = Math.min(reps, min + 1);
          if (tired) reps = Math.max(1, reps - 2);
          const load =
            st.load === null ? null : isWarm ? roundToStep(st.load * 0.5, ex.increment) : st.load;
          const rir = isWarm
            ? null
            : tired
              ? Math.max(0, Math.round(between(-0.4, 0.8)))
              : Math.max(0, Math.round(between(1, 3)));
          if (!isWarm && reps < max) allTop = false;
          const restActual = Math.round(s.rest * persona.restFactor * between(0.85, 1.3));
          const setId = uuid();
          const completed = rand() > 0.03;
          const logged: LoggedSet = {
            setType: s.type,
            loadKg: load,
            reps: ex.spec.name === 'Gainage planche' ? null : reps,
            rir,
            rpe: null,
            completed,
          };
          const rec =
            completed && !isWarm ? detectSetRecord(logged, priorSets.get(key) ?? []) : null;
          priorSets.set(key, [...(priorSets.get(key) ?? []), logged]);
          sets.push({
            id: setId,
            session_log_id: sessionId,
            adherent_id: uid,
            exercise_id: key,
            workout_exercise_id: ex.weId,
            prescribed_set_id: ex.setIds[j],
            position: j,
            set_type: s.type,
            load_kg: load,
            reps: ex.spec.name === 'Gainage planche' ? null : reps,
            duration_seconds:
              ex.spec.name === 'Gainage planche' ? Math.round(between(35, 60)) : null,
            rir: persona.scale === 'rir' ? rir : null,
            rpe: persona.scale === 'rpe' && rir !== null ? 10 - rir : null,
            rest_seconds_actual: restActual,
            rest_seconds_prescribed: s.rest,
            completed,
            performed_at: new Date(clock).toISOString(),
          });
          if (rec && w.week > 1) {
            records.push({
              id: uuid(),
              adherent_id: uid,
              exercise_id: key,
              record_type: rec.recordType,
              value: rec.value,
              load_kg: rec.loadKg,
              achieved_at: new Date(clock).toISOString(),
              set_log_id: setId,
              session_log_id: sessionId,
            });
          }
          clock += restActual * 1000;
        }
        // Double progression : en haut de fourchette partout → +incrément, sinon +1 rep.
        if (st.load !== null && allTop && !stagnates)
          state.set(key, { load: st.load + ex.increment, reps: min });
        else state.set(key, { load: st.load, reps: Math.min(max, st.reps + (stagnates ? 0 : 1)) });
      }
      const endedAt = clock + 5 * 60_000;
      sessions.push({
        id: sessionId,
        adherent_id: uid,
        program_id: programId,
        workout_id: w.id,
        scheduled_date: date,
        started_at: startedAt.toISOString(),
        ended_at: new Date(endedAt).toISOString(),
        duration_seconds: Math.round((endedAt - startedAt.getTime()) / 1000),
        status: 'completed',
        rating: tired ? pick([8, 9, 9, 10]) : pick([5, 6, 6, 7, 7, 8]),
        notes:
          rand() > 0.8
            ? pick([
                'Bonne énergie aujourd’hui',
                'Un peu fatigué(e)',
                'Machine prise, j’ai remplacé',
                'Super séance !',
              ])
            : null,
        // Les anciennes séances sont considérées comme déjà analysées.
        analyzed_at: new Date().toISOString(),
      });
    }
    await insertMany('session_logs', sessions);
    await insertMany('set_logs', sets);
    // Les records ne déclenchent pas d'alerte pour l'historique ancien : on garde les 3 derniers.
    await insertMany('personal_records', records.slice(-3));
    // La dernière séance reste à analyser (suggestions générées plus bas).
    const last = sessions[sessions.length - 1];
    if (last)
      await must(
        db
          .from('session_logs')
          .update({ analyzed_at: null })
          .eq('id', last.id as string),
        'séance à analyser',
      );

    // Pesées (4 à 6 par semaine) et bilans hebdo (dimanche).
    const weights: Record<string, unknown>[] = [];
    const checkins: Record<string, unknown>[] = [];
    for (let d = 0; d < HISTORY_WEEKS * 7; d++) {
      const date = addDays(start, d);
      if (date >= today) break;
      const trend = persona.weight * (1 + (persona.weeklyWeightChange / 100) * (d / 7));
      if (rand() < 0.75)
        weights.push({
          id: uuid(),
          adherent_id: uid,
          measured_on: date,
          weight_kg: Math.round((trend + between(-0.6, 0.6)) * 10) / 10,
        });
      if (d % 7 === 6 && date <= lastActive && rand() < 0.85) {
        const late = d >= (HISTORY_WEEKS - 2) * 7;
        checkins.push({
          id: uuid(),
          adherent_id: uid,
          week_start: weekStart(date),
          weight_kg: Math.round(trend * 10) / 10,
          sleep: persona.key === 'sarah' && late ? 2 : pick([3, 4, 4, 5]),
          energy: persona.key === 'sarah' && late ? 2 : pick([3, 3, 4, 5]),
          stress: pick([2, 2, 3, 4]),
          soreness: pick([2, 3, 3, 4]),
          comment: pick([
            'Bonne semaine !',
            'Semaine chargée au travail.',
            'Je sens les progrès.',
            'Un peu de courbatures aux jambes.',
            null,
          ]),
          submitted_at: `${date}T20:00:00Z`,
          coach_reply:
            rand() < 0.6
              ? pick([
                  'Bravo, continue comme ça 💪',
                  'Pense à bien dormir cette semaine.',
                  'Super régularité !',
                ])
              : null,
          coach_replied_at: null,
        });
      }
    }
    await insertMany('body_weights', weights);
    await insertMany(
      'checkins',
      checkins.map((c) => ({ ...c, coach_replied_at: c.coach_reply ? c.submitted_at : null })),
    );

    // Messages.
    const conv = await must(
      db.from('conversations').select('id').eq('adherent_id', uid).single(),
      'conversation',
    );
    const t0 = addDays(today, -6);
    await insertMany('messages', [
      {
        id: uuid(),
        conversation_id: conv?.id,
        sender_id: coachId,
        body: `Salut ${persona.first} ! Ton programme est en ligne, n’hésite pas si tu as une question.`,
        created_at: `${addDays(start, 0)}T09:00:00Z`,
        read_at: `${addDays(start, 0)}T12:00:00Z`,
      },
      {
        id: uuid(),
        conversation_id: conv?.id,
        sender_id: uid,
        body: pick(['Merci coach ! Hâte de commencer.', 'Top, merci 🙏', 'Ça marche !']),
        created_at: `${addDays(start, 0)}T12:05:00Z`,
        read_at: `${addDays(start, 0)}T13:00:00Z`,
      },
      {
        id: uuid(),
        conversation_id: conv?.id,
        sender_id: uid,
        body: pick([
          'Pour le squat, je descends jusqu’où exactement ?',
          'Je peux décaler ma séance de vendredi à samedi ?',
          'J’ai senti une petite gêne à l’épaule, c’est normal ?',
        ]),
        created_at: `${t0}T18:30:00Z`,
        read_at: null,
      },
    ]);
    console.warn(
      `  ✓ ${persona.first} : ${sessions.length} séances, ${sets.length} séries, ${weights.length} pesées`,
    );
  }

  // Analyse des dernières séances → suggestions et alertes pour le coach.
  const analysis = await analyzePending(db);
  // Alertes quotidiennes (séance manquée, inactivité, bilan non rempli).
  await db.rpc('run_hourly_jobs', { p_now: `${today}T05:10:00Z` });
  console.warn(
    `✔ Terminé : ${analysis.suggestions} suggestion(s), ${analysis.alerts} alerte(s) d’analyse.`,
  );
  console.warn(
    `  Connexion coach : coach@demo.fr (si aucun coach n’existait) — adhérents : julie@demo.fr… / ${PASSWORD}`,
  );
}

main().catch((e) => {
  console.error('✗ Échec :', e instanceof Error ? e.message : e);
  process.exit(1);
});
