// AI explanation layer for the (deterministic) overload number. Lazy OpenRouter:
// falls back to the deterministic rationale when no key is configured. Never invents the number.
import 'server-only';
import type { Recommendation } from './recommend';

const apiKey = process.env.OPENROUTER_API_KEY;

export async function explainRecommendation(
  rec: Recommendation,
  exerciseName: string,
  locale: 'en' | 'es',
): Promise<string> {
  if (!apiKey) return rec.rationale;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
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
      }),
    });
    if (!res.ok) return rec.rationale;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json?.choices?.[0]?.message?.content?.trim() || rec.rationale;
  } catch {
    return rec.rationale;
  }
}
