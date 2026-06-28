'use server';

// Approval-queue actions (PRD-30, WP8). Two server actions, two different guards:
//   submitDraft - requireCoach (assistant/coach/operator may DRAFT). NEVER publishes. Always pending.
//   decide      - requireApprover (coach/operator ONLY). THE GATE. The only code that flips a row to
//                 approved/rejected and performs the publish.
//
// THE BYPASS-BLOCK (PRD-30 Section 8b, the marquee verification): an assistant_coach calling decide()
// is redirected by requireApprover BEFORE any DB read or publish runs. The publish dispatcher
// (publishApprovedItem) is server-only with decide() as its sole caller. Backed by approval_queue
// having NO client UPDATE policy (the approved transition runs only under the service role here).
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach, requireApprover } from '@/lib/auth/guards';
import { hasRole, APPROVER_ROLES } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isAssignedTo } from '@/lib/coach/assignments';
import { publishApprovedItem } from '@/lib/coach/approval-publish';

export type DraftResult = { ok: boolean; error?: string };

// Per-item payload validation. A message needs a body; a meal_plan needs the contacts(id) target
// (contactId, a DIFFERENT id space from client_id) plus optional macro targets.
const MessagePayload = z.object({
  body: z.string().trim().min(1).max(4000),
});
const MealPlanPayload = z.object({
  contactId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  calorieGoal: z.number().int().positive().max(20_000).optional(),
  proteinPct: z.number().int().min(0).max(100).optional(),
  carbPct: z.number().int().min(0).max(100).optional(),
  fatPct: z.number().int().min(0).max(100).optional(),
  macroTiming: z.string().trim().max(120).optional(),
});

const DraftInput = z.discriminatedUnion('itemType', [
  z.object({ itemType: z.literal('message'), clientId: z.string().uuid(), payload: MessagePayload }),
  z.object({ itemType: z.literal('meal_plan'), clientId: z.string().uuid(), payload: MealPlanPayload }),
]);

// Submit a draft into the approval queue. Inserts ONE approval_queue row status='pending'. NEVER writes
// a messages/meal_plans row. Assistants may only draft for a client they are actively assigned to;
// approvers may draft for anyone.
export async function submitDraft(input: unknown): Promise<DraftResult> {
  const parsed = DraftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireCoach(); // assistant passes here on purpose: they MAY draft
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  // Assistant draft scope: only for actively-assigned clients. Approvers (coach/operator) skip this.
  if (!hasRole(ctx.role, APPROVER_ROLES)) {
    const ok = await isAssignedTo(ctx.companyId, ctx.userId, parsed.data.clientId);
    if (!ok) return { ok: false, error: 'not_assigned' };
  }

  const sb = await createClient(); // cookie client: the queue_insert RLS policy applies (status=pending)
  const { error } = await sb.from('approval_queue').insert({
    company_id: ctx.companyId,
    item_type: parsed.data.itemType,
    client_id: parsed.data.clientId,
    drafted_by: ctx.userId,
    payload: parsed.data.payload,
    status: 'pending', // ALWAYS pending on insert. No publish here, by construction.
  });
  if (error) {
    console.error('submitDraft:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/coach/drafts');
  revalidatePath('/coach/approvals');
  return { ok: true };
}

const DecideInput = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(1000).optional(),
});

// THE GATE. Approve -> publish the real row then mark approved. Reject -> mark rejected, publish nothing.
// requireApprover() is the enforcement point: an assistant_coach is redirected to /coach/drafts before
// any of this runs, so the bypass is impossible. Idempotent: reads + updates only a still-pending row.
export async function decide(input: unknown): Promise<DraftResult> {
  const parsed = DecideInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  // LAYER 1 (the real gate): assistant_coach cannot reach this line. requireApprover redirects them.
  const ctx = await requireApprover();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const sb = createServiceClient(); // service role: the trusted publisher (BYPASSRLS, as designed)

  // Read the still-PENDING row scoped to this tenant. Already-decided -> no-op (idempotent).
  const { data: item } = await sb
    .from('approval_queue')
    .select('id, item_type, client_id, drafted_by, payload, status')
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!item) return { ok: false, error: 'not_found_or_decided' };

  let itemRef: string | undefined;
  if (parsed.data.decision === 'approved') {
    // Publish FIRST, then mark approved. If publish fails the row stays pending and nothing leaked
    // (no cross-table transaction in PostgREST, so order is the safety property).
    const pub = await publishApprovedItem(ctx.companyId, {
      itemType: item.item_type,
      clientId: item.client_id,
      draftedBy: item.drafted_by,
      payload: (item.payload ?? {}) as Record<string, unknown>,
    });
    if (!pub.ok) return { ok: false, error: pub.error ?? 'publish_failed' };
    itemRef = pub.itemRef;
  }

  // Re-assert status='pending' in the WHERE clause: a double-click / race finds no pending row and
  // no-ops, so a draft is never published twice.
  const { error } = await sb
    .from('approval_queue')
    .update({
      status: parsed.data.decision,
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      decision_note: parsed.data.note ?? null,
      item_ref: itemRef ?? null,
    })
    .eq('id', item.id)
    .eq('company_id', ctx.companyId)
    .eq('status', 'pending');
  if (error) {
    console.error('decide:', error.message);
    return { ok: false, error: 'failed' };
  }

  revalidatePath('/coach/approvals');
  revalidatePath('/coach/drafts');
  if (parsed.data.decision === 'approved' && item.item_type === 'message') {
    revalidatePath('/coach/inbox');
  }
  return { ok: true };
}
