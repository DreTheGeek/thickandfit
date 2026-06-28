'use server';

// Assignment-management actions (PRD-30, WP8). Approver-only: requireApprover admits coach + operator
// but NOT assistant_coach (an assistant cannot assign clients or set their own rate). Mirrors the
// house action shape (Zod + guard + service write + revalidatePath) from challenge-actions.ts.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireApprover } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';

export type AssignmentResult = { ok: boolean; error?: string };

const UpsertInput = z.object({
  assistantId: z.string().uuid(),
  clientId: z.string().uuid(),
  monthlyRateCents: z.number().int().min(0).max(100_000_000), // bigint cents; cap = $1,000,000.00
  status: z.enum(['active', 'paused', 'ended']).default('active'),
});

// Create or update one assignment (unique on company+assistant+client). Operator/coach only.
export async function upsertAssignment(input: unknown): Promise<AssignmentResult> {
  const parsed = UpsertInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  if (parsed.data.assistantId === parsed.data.clientId) return { ok: false, error: 'same_person' };

  const ctx = await requireApprover();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const sb = createServiceClient();
  const { error } = await sb.from('coaching_assignments').upsert(
    {
      company_id: ctx.companyId,
      assistant_id: parsed.data.assistantId,
      client_id: parsed.data.clientId,
      monthly_rate_cents: parsed.data.monthlyRateCents,
      status: parsed.data.status,
      assigned_by: ctx.userId,
    },
    { onConflict: 'company_id,assistant_id,client_id' },
  );
  if (error) {
    console.error('upsertAssignment:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/coach/assignments');
  return { ok: true };
}

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'ended']),
});

// Toggle one assignment's status (e.g. pause/end a roster slot). Operator/coach only. Scoped to the
// tenant in the WHERE clause; the service client bypasses RLS so the company filter is explicit.
export async function setAssignmentStatus(input: unknown): Promise<AssignmentResult> {
  const parsed = StatusInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const ctx = await requireApprover();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const sb = createServiceClient();
  const { error } = await sb
    .from('coaching_assignments')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .eq('company_id', ctx.companyId);
  if (error) {
    console.error('setAssignmentStatus:', error.message);
    return { ok: false, error: 'failed' };
  }
  revalidatePath('/coach/assignments');
  return { ok: true };
}
