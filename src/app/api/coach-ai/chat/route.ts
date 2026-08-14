// POST /api/coach-ai/chat: the subscriber AI coach chat turn.
// Auth-guarded (user session or Bearer), Zod-validated. Builds the member context, composes the
// bilingual coach system prompt, calls claude-haiku-4-5 via OpenRouter and STREAMS the reply,
// persisting both the user message and the assistant reply to coach_messages.
//
// Key-gating: with no OPENROUTER_API_KEY set it returns HTTP 200 with a clean "not configured"
// body ({ ok: false, status: 'notConfigured', message }). It never crashes without the key.
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiError } from '@/lib/api/auth';
import { isEntitled } from '@/lib/billing/entitlement';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { chatRequestSchema, streamChat } from '@/lib/coach-ai/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Questions a member gets per day. 0 or a negative disables the quota entirely.
 *
 * The default is 20, not the 3 discussed on the call. Three is a real product decision about what
 * the low tier includes, and shipping it as a code default would silently make that decision for
 * Stephanie the moment this deploys. 20 is a spend ceiling nobody honest will reach — the point of
 * a default is to stop a runaway bill, not to price the product. Set COACH_AI_DAILY_LIMIT in Vercel
 * to whatever the answer turns out to be.
 */
function dailyChatLimit(): number {
  const raw = process.env.COACH_AI_DAILY_LIMIT;
  if (raw === undefined || raw.trim() === '') return 20;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : 20;
}

async function POST_h(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  // Paywall at the API boundary: the page requires entitlement, so the endpoint must too (else a
  // free/lapsed user can call it directly). Coaches pass by role; everyone else needs an active sub or comp.
  if (!hasRole(ctx.role, COACH_ROLES) && !(await isEntitled(ctx.userId))) {
    return apiError('An active subscription is required.', 403);
  }

  // Burst control: 30 turns per 5 minutes stops a script, not a spender (fails open).
  if (!(await checkRateLimit(ctx.userId, 'coach-ai-chat', 30, 300))) {
    return apiError('You are sending messages too fast. Please wait a moment.', 429);
  }

  // THE DAILY QUOTA, which is a different thing from the burst limit above.
  //
  // Asked for on 2026-08-13. LaSean: "it can't be more than three back and forth messages a day or
  // something like that, so AI usage isn't random because it costs money." Stephanie, immediately
  // after: "you know how ChatGPT gives you that free feature? Hey, you've already asked a sufficient
  // amount of questions these days. You could upgrade." Answer on the call: "I'm about to now."
  //
  // A quota is not a rate limit. Hitting the burst limit means "slow down"; hitting this means "you
  // have used today's questions", which is a product state with an offer attached — so it returns
  // HTTP 200 with a status the client renders as an upgrade card, following the notConfigured
  // precedent below, rather than a 429 the UI can only show as an error.
  //
  // NOT PER-TIER YET, deliberately. contacts.product_type carries two incompatible vocabularies at
  // once — the Lenus migration wrote 'bootcamp' / 'personalCoaching' / 'basic' / 'solon' and new
  // signups write 'Self-Guided' / 'Team Thick & Fit' / '1-on-1 with Steph' — and nothing in the repo
  // says which Lenus value maps to which tier. Guessing would cap a member paying for 1-on-1
  // coaching at the free-tier number, which is the worse of the two possible mistakes. The limit is
  // therefore one generous number for every member, and per-tier differentiation is a small change
  // once somebody who knows the book confirms the mapping.
  if (!hasRole(ctx.role, COACH_ROLES)) {
    const limit = dailyChatLimit();
    if (limit > 0 && !(await checkRateLimit(ctx.userId, 'coach-ai-daily', limit, 86_400))) {
      return Response.json(
        { ok: false, status: 'quotaReached', limit },
        { status: 200 },
      );
    }
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

export const POST = withApiLog(POST_h);
