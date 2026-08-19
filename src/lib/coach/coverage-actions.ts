'use server';
// Assign a member to a coach, and declare who is covering while a coach is away.
//
// Coach-driven, like pauses: these are rota decisions between staff, never member-facing. See
// coverage-shared.ts for how the two facts resolve into "who holds her today", and
// .planning/OPERATOR-GAPS.md Part 4 for why "she cannot leave if she is the only person who can do
// the work" is the problem being solved.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

export type CoverageResult = { ok: true } | { ok: false; error: string };

const AssignInput = z.object({
  profileId: z.string().uuid(),
  // Null hands her back to the company, which is a real answer and the default state of the whole
  // roster today — not an "unset" to be avoided.
  coachId: z.string().uuid().nullable(),
});

/** Give a member an owner, or hand her back to the company. */
export async function assignCoachAction(input: unknown): Promise<CoverageResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = AssignInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { profileId, coachId } = parsed.data;

  const svc = createServiceClient();

  // Both ids must belong to this company. Never trust a client-supplied uuid — the same ownership
  // guard assignProgram uses, and the reason this is not a bare update.
  const { data: member } = await svc
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('company_id', ctx.companyId)
    .maybeSingle();
  if (!member) return { ok: false, error: 'memberNotFound' };

  if (coachId !== null) {
    const { data: coach } = await svc
      .from('profiles')
      .select('id, role')
      .eq('id', coachId)
      .eq('company_id', ctx.companyId)
      .in('role', ['coach', 'assistant_coach'])
      .maybeSingle();
    // Operators are excluded by the role filter above: ops is not coaching, and an operator holding
    // clients would put member work on a queue nobody reads as a coaching queue.
    if (!coach) return { ok: false, error: 'coachNotFound' };
  }

  const { error } = await svc
    .from('profiles')
    .update({ assigned_coach_id: coachId })
    .eq('id', profileId)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('assignCoachAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'profile',
    entityId: profileId,
    action: coachId === null ? 'member.unassign_coach' : 'member.assign_coach',
    newState: { assignedCoachId: coachId },
  });

  revalidatePath('/coach/clients');
  revalidatePath(`/coach/subscribers/${profileId}`);
  return { ok: true };
}

const CoverageInput = z.object({
  coachId: z.string().uuid(),
  coveringCoachId: z.string().uuid(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // INCLUSIVE: the last day away. "Back on the 20th" is the 19th, and the caller does that
  // conversion once so the stored date always means the same thing. See isCoverageActive.
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});

/** "I am away until the 19th, route everything to Dani." */
export async function setCoverageAction(input: unknown): Promise<CoverageResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = CoverageInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { coachId, coveringCoachId, startsOn, endsOn, note } = parsed.data;

  // Both constraints also exist on the table (0143). Checked here too so the UI gets a named error
  // instead of a Postgres constraint violation surfacing as 'failed'.
  if (coveringCoachId === coachId) return { ok: false, error: 'cannotCoverSelf' };
  if (endsOn < startsOn) return { ok: false, error: 'endsBeforeStarts' };

  const svc = createServiceClient();
  const { data: staff } = await svc
    .from('profiles')
    .select('id')
    .eq('company_id', ctx.companyId)
    .in('role', ['coach', 'assistant_coach'])
    .in('id', [coachId, coveringCoachId]);
  if ((staff ?? []).length !== 2) return { ok: false, error: 'coachNotFound' };

  const { error } = await svc.from('coach_coverage').insert({
    company_id: ctx.companyId,
    coach_id: coachId,
    covering_coach_id: coveringCoachId,
    starts_on: startsOn,
    ends_on: endsOn,
    note: note ?? null,
    created_by: ctx.userId,
  });
  if (error) {
    console.error('setCoverageAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'coach_coverage',
    entityId: coachId,
    action: 'coverage.set',
    newState: { coveringCoachId, startsOn, endsOn },
  });

  revalidatePath('/coach');
  return { ok: true };
}

const EndCoverageInput = z.object({ id: z.string().uuid() });

/**
 * Cancel an arrangement outright.
 *
 * DELETES rather than end-dating. A pause is revoked-not-deleted because "who was paused when" is
 * part of a member's record; a rota entry that was cancelled before it started is not a fact about
 * anybody, and leaving tombstones in a table the resolver walks every page load buys nothing. The
 * coach audit log carries the history.
 */
export async function endCoverageAction(input: unknown): Promise<CoverageResult> {
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'noCompany' };
  const parsed = EndCoverageInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const svc = createServiceClient();
  const { error } = await svc
    .from('coach_coverage')
    .delete()
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('endCoverageAction:', error.message);
    return { ok: false, error: 'failed' };
  }

  logCoachAction(svc, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'coach_coverage',
    entityId: parsed.data.id,
    action: 'coverage.end',
    newState: { deleted: true },
  });

  revalidatePath('/coach');
  return { ok: true };
}
