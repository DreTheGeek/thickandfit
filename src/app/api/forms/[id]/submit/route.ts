// Client submits a published, assigned form. POST { answers: { [fieldId]: value } }.
import { z } from 'zod';
import { withApiLog } from '@/lib/telemetry/request-log';
import { resolveAuth } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { submitResponse } from '@/lib/forms/engine';
import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { notifyCoachOfCheckin } from '@/lib/notifications/triggers';

export const dynamic = 'force-dynamic';

const schema = z.object({ answers: z.record(z.string(), z.unknown()) });

async function POST_h(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const formId = (await params).id;
  try {
    const result = await submitResponse(ctx.companyId, formId, ctx.userId, parsed.data.answers);

    // Tell her coach. Without this the response landed in form_responses and nobody was told, so a
    // check-in was only ever seen if Stephanie happened to open that client's page. after() rather
    // than a bare void: on Vercel a fire-and-forget promise dies with the frozen lambda the moment
    // the response is returned. Failure here must not fail the submit, which already succeeded.
    const companyId = ctx.companyId;
    const userId = ctx.userId;
    after(async () => {
      try {
        const svc = createServiceClient();
        const [{ data: me }, { data: form }] = await Promise.all([
          svc.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
          svc.from('forms').select('title_en').eq('id', formId).maybeSingle(),
        ]);
        await notifyCoachOfCheckin({
          companyId,
          clientProfileId: userId,
          clientName: (me as { full_name: string | null } | null)?.full_name?.trim() || 'A member',
          formTitle: (form as { title_en: string | null } | null)?.title_en ?? 'Check-in',
        });
      } catch (err) {
        console.error('[forms/submit] notifyCoachOfCheckin failed', err);
      }
    });

    return apiSuccess(result, 201);
  } catch (e) {
    // Never leak internal error detail to the client. Log server-side, return a fixed message.
    console.error('[forms/submit] submitResponse failed', e);
    return apiError('Could not submit form', 400);
  }
}

export const POST = withApiLog(POST_h);
