// POST /api/nutrition/photo — the photo-to-macro wedge endpoint.
// Auth-guarded (user session), Zod-validated. Accepts a base64 data URL or an http(s) image URL,
// runs the analyze pipeline, and returns confidence-scored candidates with scaled macros.
// With no OPENROUTER_API_KEY set it returns { status: 'notConfigured' } and 200 — never crashes.
import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { isEntitled } from '@/lib/billing/entitlement';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { analyzeSmartPhoto } from '@/lib/nutrition/smart-scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vision + food-resolution can run 20-40s on a busy plate; 60s left no headroom and real photos timed
// out ("Something went wrong reading that photo"). Vercel now allows up to 300s. The vision + USDA
// calls also carry their own AbortSignal timeouts so nothing hangs to the ceiling.
export const maxDuration = 300;

// Either a data: URL (base64 inline) or a remote http(s) image URL. Bounded to keep payloads sane.
const Body = z
  .object({
    image: z
      .string()
      .min(8)
      .max(12_000_000)
      .refine((v) => v.startsWith('data:image/') || /^https?:\/\//i.test(v), {
        message: 'image must be a data:image/ URL or an http(s) URL',
      }),
  })
  .strict();

export async function POST(req: Request): Promise<Response> {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  // Paywall at the API boundary: the page requires entitlement, so the endpoint must too (else a
  // free/lapsed user can call it directly). Coaches pass by role; everyone else needs an active sub or comp.
  if (!hasRole(ctx.role, COACH_ROLES) && !(await isEntitled(ctx.userId))) {
    return apiError('An active subscription is required.', 403);
  }

  // Cost control: vision calls are the priciest AI path; cap per user to bound spend (fails open).
  if (!(await checkRateLimit(ctx.userId, 'nutrition-photo', 40, 3600))) {
    return apiError('Too many photo scans right now. Please try again shortly.', 429);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 422);

  const locale = await getLocale();
  const result = await analyzeSmartPhoto(parsed.data.image, locale);
  return apiSuccess(result);
}
