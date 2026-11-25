// Appel à l'API Claude (SDK officiel) pour l'analyse d'une photo de repas.
import Anthropic from 'npm:@anthropic-ai/sdk@1.9.0';

import {
  MEAL_ANALYSIS_SCHEMA,
  MEAL_ANALYSIS_SYSTEM,
  mealAnalysisPrompt,
} from '../_shared/core/index.ts';

import { ModelError, type CallModel } from './analyze.ts';

export function modelCaller(apiKey: string, model: string): CallModel {
  // Une seule nouvelle tentative : l'adhérent attend devant l'écran.
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  return async (image, hint) => {
    try {
      const res = await client.messages.create({
        model,
        max_tokens: 8000,
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: MEAL_ANALYSIS_SCHEMA },
        },
        system: MEAL_ANALYSIS_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                  data: image.base64,
                },
              },
              { type: 'text', text: mealAnalysisPrompt(hint) },
            ],
          },
        ],
      });
      // La réponse peut commencer par des blocs de réflexion : on ne garde que le texte.
      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('');
      return {
        text: text || null,
        stopReason: res.stop_reason,
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      };
    } catch (e) {
      if (
        e instanceof Anthropic.AuthenticationError ||
        e instanceof Anthropic.PermissionDeniedError
      )
        throw new ModelError('ai_auth', `${e.status} ${e.name}`);
      if (e instanceof Anthropic.RateLimitError) throw new ModelError('ai_busy', '429');
      if (e instanceof Anthropic.APIError)
        throw new ModelError(
          e.status === 529 || e.status === 503 ? 'ai_busy' : 'ai_error',
          `${e.status ?? ''} ${e.name}`,
        );
      throw new ModelError('ai_error', e instanceof Error ? e.name : 'inconnue');
    }
  };
}
