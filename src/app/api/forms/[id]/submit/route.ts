// Client submits a published, assigned form. POST { answers: { [fieldId]: value } }.
import { z } from 'zod';
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { submitResponse } from '@/lib/forms/engine';

export const dynamic = 'force-dynamic';

const schema = z.object({ answers: z.record(z.string(), z.unknown()) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveAuth(req);
  if (!ctx) return apiError('Unauthorized', 401);
  if (!ctx.companyId) return apiError('No company scope', 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError('Invalid input', 422);

  try {
    const result = await submitResponse(ctx.companyId, (await params).id, ctx.userId, parsed.data.answers);
    return apiSuccess(result, 201);
  } catch (e) {
    // Never leak internal error detail to the client. Log server-side, return a fixed message.
    console.error('[forms/submit] submitResponse failed', e);
    return apiError('Could not submit form', 400);
  }
}
