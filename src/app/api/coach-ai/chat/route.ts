// POST /api/coach-ai/chat: the subscriber AI coach chat turn.
// Auth-guarded (user session or Bearer), Zod-validated. Builds the member context, composes the
// bilingual coach system prompt, calls claude-haiku-4-5 via OpenRouter and STREAMS the reply,
// persisting both the user message and the assistant reply to coach_messages.
//
// Key-gating: with no OPENROUTER_API_KEY set it returns HTTP 200 with a clean "not configured"
// body ({ ok: false, status: 'notConfigured', message }). It never crashes without the key.
import { resolveAuth } from '@/lib/auth/session';
import { apiError } from '@/lib/api/auth';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { chatRequestSchema, streamChat } from '@/lib/coach-ai/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  // Cost control: cap AI chat turns per user so OpenRouter spend cannot run away (fails open).
  if (!(await checkRateLimit(ctx.userId, 'coach-ai-chat', 30, 300))) {
    return apiError('You are sending messages too fast. Please wait a moment.', 429);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 422);
  }

  const result = await streamChat(ctx.userId, ctx.companyId, parsed.data);

  // Graceful degradation: no key (or upstream unavailable) -> 200 with a clear, localized body.
  if (result.status === 'notConfigured') {
    return Response.json(
      { ok: false, status: 'notConfigured', message: result.message },
      { status: 200 },
    );
  }

  // Stream the assistant's words as plain UTF-8 text chunks for progressive rendering.
  return new Response(result.stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
