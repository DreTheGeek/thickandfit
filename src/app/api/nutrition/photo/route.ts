// POST /api/nutrition/photo: the photo-to-macro wedge endpoint.
// Auth-guarded (user session), Zod-validated. Accepts an inline base64 data: URL only (the client
// always sends the captured/resized image as a data URL), runs the analyze pipeline, and returns
// confidence-scored candidates with scaled macros.
// With no OPENROUTER_API_KEY set it returns { status: 'notConfigured' } and 200, never crashes.
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { after } from 'next/server';
import { getLocale } from 'next-intl/server';
import { resolveAuth, hasRole, COACH_ROLES } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { isEntitled } from '@/lib/billing/entitlement';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { analyzeSmartPhoto } from '@/lib/nutrition/smart-scan';
import { storeScanImage } from '@/lib/nutrition/scan-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vision + food-resolution can run 20-40s on a busy plate; 60s left no headroom and real photos timed
// out ("Something went wrong reading that photo"). Vercel now allows up to 300s. The vision + USDA
// calls also carry their own AbortSignal timeouts so nothing hangs to the ceiling.
export const maxDuration = 300;

// Inline base64 data:image/ URL only. Remote http(s) URLs are intentionally NOT accepted: the app
// never sends one, and passing a caller-supplied URL through to the vision provider would let a user
// make the provider fetch an arbitrary (possibly internal) URL. Bounded to keep payloads sane.
const Body = z
  .object({
    image: z
      .string()
      .min(8)
      .max(12_000_000)
      .refine((v) => v.startsWith('data:image/'), {
        message: 'image must be a data:image/ URL',
      }),
  })
  .strict();

async function POST_h(req: Request): Promise<Response> {
  const t0 = Date.now();
  // Parse the (large base64) body in parallel with the auth/entitlement DB round-trips instead of after
  // them, so the parse overlaps the serial pre-vision latency.
  const bodyPromise = req.json().then((v) => v as unknown).catch(() => undefined);

  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  // Paywall + cost control at the API boundary. Entitlement (paywall) and the rate-limit gate are
  // independent, so run them concurrently rather than serially before the vision call.
  const [entitled, underLimit] = await Promise.all([
    hasRole(ctx.role, COACH_ROLES) ? Promise.resolve(true) : isEntitled(ctx.userId),
    checkRateLimit(ctx.userId, 'nutrition-photo', 40, 3600),
  ]);
  if (!entitled) return apiError('An active subscription is required.', 403);
  if (!underLimit) return apiError('Too many photo scans right now. Please try again shortly.', 429);

  const raw = await bodyPromise;
  if (raw === undefined) return apiError('Invalid JSON body', 400);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 422);

  const tGate = Date.now();
  const locale = await getLocale();
  // Pass tenant/member so the scan writes a provenance row and returns its id (for correction capture).
  const result = await analyzeSmartPhoto(parsed.data.image, locale, {
    companyId: ctx.companyId,
    profileId: ctx.userId,
  });
  // Attribute prod latency: how much is the auth/entitlement/rate-limit gate vs the analyze pipeline.
  console.log(`[photo] gate ${tGate - t0}ms, analyze ${Date.now() - tGate}ms, total ${Date.now() - t0}ms, status ${result.status}`);
  // Persist the scan image keyed by inference id: once the user corrects this scan, image +
  // correction = an automatic gold eval case. after() (not a bare void) because a serverless
  // function freezes when the response returns; a multi-MB upload started fire-and-forget would
  // silently die mid-flight. after() keeps the instance alive until the upload settles, and the
  // response still goes out first (zero p95 impact).
  if ((result.status === 'ok' || result.status === 'product') && result.inferenceId) {
    const inferenceId = result.inferenceId;
    after(() => storeScanImage(inferenceId, parsed.data.image));
  }
  return apiSuccess(result);
}

export const POST = withApiLog(POST_h);
