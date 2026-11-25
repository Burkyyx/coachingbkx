/**
 * Analyse d'une photo de repas par IA : consigne, format de réponse imposé (JSON Schema)
 * et validation de la réponse. TypeScript pur, partagé avec l'Edge Function « analyze-meal ».
 *
 * L'IA PROPOSE une estimation : l'adhérent la vérifie et la corrige avant d'enregistrer.
 */

export type AiConfidence = 'low' | 'medium' | 'high';

export type AnalyzedItem = {
  name: string;
  quantityG: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: AiConfidence;
};

export type MealAnalysis = {
  /** false : la photo ne montre pas de nourriture (aucun aliment renvoyé). */
  isFood: boolean;
  items: AnalyzedItem[];
  /** Remarque courte pour l'adhérent (ex. « sauce non visible, à ajouter »). */
  note: string;
};

/** Consigne système (stable : favorise la mise en cache côté API). */
export const MEAL_ANALYSIS_SYSTEM = [
  'Tu analyses la photo d’un repas pour un journal alimentaire (application de coaching sportif en France).',
  'Identifie chaque aliment visible et estime sa quantité en grammes, puis ses calories (kcal), protéines, glucides et lipides (g) pour CETTE quantité.',
  'Règles :',
  '- Noms d’aliments en français, courts et précis (ex. « riz basmati cuit », « blanc de poulet grillé »).',
  '- Quantités réalistes d’après la taille de l’assiette, des couverts ou de l’emballage ; aliments cuits pesés cuits.',
  '- Valeurs nutritionnelles de référence (type table Ciqual) ; pense à l’huile de cuisson et aux sauces visibles.',
  '- confidence : « high » si l’aliment et la quantité sont évidents, « medium » si l’un des deux est incertain, « low » si tu devines.',
  '- note : une phrase courte et neutre pour aider à corriger (élément caché, portion difficile à juger), ou une chaîne vide.',
  '- Aucun jugement sur le repas, aucun conseil diététique.',
  '- Si la photo ne montre pas de nourriture : is_food = false et items vide.',
  '- Si l’utilisateur ajoute une précision, tiens-en compte.',
].join('\n');

/** Format de réponse imposé (structured outputs : objets fermés, sans bornes numériques). */
export const MEAL_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'note'],
  properties: {
    is_food: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
        properties: {
          name: { type: 'string' },
          quantity_g: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
      },
    },
    note: { type: 'string' },
  },
} as const;

/** Message utilisateur accompagnant la photo (précision facultative de l'adhérent). */
export function mealAnalysisPrompt(hint?: string | null): string {
  const h = (hint ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return h ? `Analyse ce repas. Précision de l’utilisateur : « ${h} »` : 'Analyse ce repas.';
}

const MAX_ITEMS = 15;

function bounded(v: unknown, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max
    ? Math.round(v * 10) / 10
    : null;
}

/**
 * Valide la réponse de l'IA (texte JSON). null si elle est inexploitable.
 * Les valeurs aberrantes invalident l'aliment concerné, pas toute la réponse.
 */
export function parseMealAnalysis(text: string | null | undefined): MealAnalysis | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.is_food !== 'boolean' || !Array.isArray(r.items)) return null;

  const items: AnalyzedItem[] = [];
  for (const it of r.items.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== 'object') continue;
    const x = it as Record<string, unknown>;
    const name = typeof x.name === 'string' ? x.name.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    const quantityG = bounded(x.quantity_g, 3000);
    const kcal = bounded(x.kcal, 5000);
    const proteinG = bounded(x.protein_g, 500);
    const carbsG = bounded(x.carbs_g, 1000);
    const fatG = bounded(x.fat_g, 500);
    const confidence: AiConfidence =
      x.confidence === 'high' || x.confidence === 'medium' ? x.confidence : 'low';
    if (!name || quantityG === null || kcal === null) continue;
    if (proteinG === null || carbsG === null || fatG === null) continue;
    items.push({ name, quantityG, kcal, proteinG, carbsG, fatG, confidence });
  }
  const note = typeof r.note === 'string' ? r.note.trim().slice(0, 300) : '';
  if (r.is_food && items.length === 0) return null;
  return { isFood: r.is_food && items.length > 0, items: r.is_food ? items : [], note };
}

/** Prix indicatifs (USD par million de jetons : entrée, sortie) pour le suivi des coûts. */
const PRICES_PER_MTOK: Record<string, readonly [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
};

/** Coût estimé d'un appel (0 si le modèle n'est pas dans la table). */
export function aiCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES_PER_MTOK[model];
  if (!p) return 0;
  return Math.round(((inputTokens * p[0] + outputTokens * p[1]) / 1_000_000) * 1e6) / 1e6;
}
