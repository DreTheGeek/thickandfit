// AI explanation layer for the (deterministic) overload number. Lazy OpenRouter via the shared
// client: falls back to the deterministic rationale when no key is configured or the call fails.
// Never invents the number. No provenance context: this is a phrasing layer, not a learning-loop
// feature (there is no user correction to capture).
import 'server-only';
import { callJson } from '@/lib/ai/client';
import { AI_MODELS } from '@/lib/ai/models';
import type { Recommendation } from './recommend';

export async function explainRecommendation(
  rec: Recommendation,
  exerciseName: string,
  locale: 'en' | 'es',
): Promise<string> {
  const result = await callJson({
    models: [AI_MODELS.overloadExplain],
    responseFormat: 'text',
    timeoutMs: 20_000,
    messages: [
      {
        role: 'system',
        content: `You are Stephanie, an encouraging fitness coach. Reply with ONE short ${
          locale === 'es' ? 'Spanish' : 'English'
        } sentence. Do not change the numbers.`,
      },
      {
        role: 'user',
        content: `Next ${exerciseName}: ${rec.action}, weight ${rec.weight ?? 'bodyweight'}, reps ${rec.reps}. Why: ${rec.rationale}`,
      },
    ],
  });
  return result.status === 'ok' && result.content ? result.content : rec.rationale;
}
