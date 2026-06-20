// POST /api/nutrition/photo — the photo-to-macro wedge endpoint.
// Auth-guarded (user session), Zod-validated. Accepts a base64 data URL or an http(s) image URL,
// runs the analyze pipeline, and returns confidence-scored candidates with scaled macros.
// With no OPENROUTER_API_KEY set it returns { status: 'notConfigured' } and 200 — never crashes.
import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { analyzeMealPhoto } from '@/lib/nutrition/photo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid input', 422);

  const locale = await getLocale();
  const result = await analyzeMealPhoto(parsed.data.image, locale);
  return apiSuccess(result);
}
