// A member switching herself onto a different starting program.
//
// THE QUESTION THIS ANSWERS, verbatim: "why was that decided for me, and I didn't choose?" Naming
// the matched program on the reveal screen answers half of it. This is the other half.
//
// FOUR THINGS BOUND WHAT SHE CAN DO HERE, and each one is load-bearing:
//
//   1. Only plans marked is_starter_candidate. She cannot browse the library and take another
//      member's one-client block, and she cannot take a challenge with a cohort and a start date.
//   2. Only her OWN company's plans, checked in the query rather than trusted from the body.
//   3. Only while every assignment she holds was made by the software. The moment a coach assigns
//      her something (assigned_by is not null), this route refuses: a member must not be able to
//      undo Stephanie's decision from her phone, and "she swapped off the plan I wrote" with no
//      record of it is the kind of thing that ends a coaching relationship.
//   4. The new assignment is still recorded as automatic (assigned_by stays null), because it is:
//      she picked from a list the software offered, and no coach has looked at her yet. That keeps
//      /workouts honest about "Steph writes your plan by hand" for exactly as long as it is true.
import { z } from 'zod';
import { resolveAuth } from '@/lib/auth/session';
import { withApiLog } from '@/lib/telemetry/request-log';
import { apiSuccess, apiError } from '@/lib/api/auth';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

const schema = z.object({ plan_id: z.string().uuid() });

async function POST_h(req: Request) {
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

  const svc = createServiceClient();

  // (1) + (2). A plan that is not offerable, or belongs to another tenant, is simply not found.
  const { data: plan, error: planErr } = await svc
    .from('plans')
    .select('id')
    .eq('id', parsed.data.plan_id)
    .eq('company_id', ctx.companyId)
    .eq('is_starter_candidate', true)
    .is('archived_at', null)
    .maybeSingle();
  if (planErr) {
    console.error('choose plan lookup:', planErr.message);
    return apiError('Could not load that program', 500);
  }
  if (!plan) return apiError('Not available', 404);

  // (3). Read every assignment she holds, not just the newest: a coach may have assigned something
  // months ago that she is no longer on, and that is still a human decision this route must respect.
  const { data: held, error: heldErr } = await svc
    .from('plan_assignments')
    .select('id, plan_id, assigned_by')
    .eq('company_id', ctx.companyId)
    .eq('profile_id', ctx.userId);
  if (heldErr) {
    console.error('choose plan existing:', heldErr.message);
    return apiError('Could not load your programs', 500);
  }
  const rows = held ?? [];
  if (rows.some((r) => r.assigned_by != null)) return apiError('A coach chose your program', 409);

  // Drop the automatic ones she is replacing. Delete rather than leave them: /workouts renders the
  // newest assignment as "your program" and keeps the rest as history, so leaving a starter she
  // never trained would put a program she rejected into her records.
  const stale = rows.filter((r) => r.plan_id !== plan.id).map((r) => r.id);
  if (stale.length > 0) {
    const { error: delErr } = await svc.from('plan_assignments').delete().in('id', stale);
    if (delErr) {
      console.error('choose plan cleanup:', delErr.message);
      return apiError('Could not switch your program', 500);
    }
  }

  // (4). assigned_by stays NULL: she chose from what the software offered, which is not the same as
  // a coach having written it for her, and the member-facing copy keys off that difference.
  const { error } = await svc.from('plan_assignments').upsert(
    {
      company_id: ctx.companyId,
      plan_id: plan.id,
      profile_id: ctx.userId,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: 'plan_id,profile_id' },
  );
  if (error) {
    console.error('choose plan assign:', error.message);
    return apiError('Could not switch your program', 500);
  }

  return apiSuccess({ planId: plan.id });
}

export const POST = withApiLog(POST_h);
