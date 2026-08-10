'use server';
// The client's goal weight, editable by her coach.
//
// target_weight_kg has existed on client_intake since the Lenus migration and was read-only: it
// arrived with whatever the client typed at intake, sometimes years ago, and Stephanie had no way to
// move it after a conversation. A goal she cannot change is a goal that goes stale and then gets
// ignored, which is how the number ends up meaning nothing.
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { logCoachAction } from '@/lib/coach/audit';

// Bounds, not validation theatre: 25kg is below any adult and 300kg is above the heaviest recorded
// intake, so anything outside is a typo (a stray digit, or pounds entered into a kg field). Null is
// allowed and means "no goal", which is a legitimate state and different from zero.
const Input = z.object({
  contactId: z.string().uuid(),
  targetWeightKg: z.number().min(25).max(300).nullable(),
});

export type WeightGoalResult = { ok: true; targetWeightKg: number | null } | { ok: false; error: string };

export async function setWeightGoalAction(input: unknown): Promise<WeightGoalResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const ctx = await requireCoach();
  if (!ctx.companyId) return { ok: false, error: 'no_company' };

  const sb = createServiceClient();
  const { contactId, targetWeightKg } = parsed.data;

  // Read first, so the audit trail records what it was as well as what it became. A goal moving
  // from 68 to 75 is a coaching decision worth being able to reconstruct later.
  const { data: before } = await sb
    .from('client_intake')
    .select('target_weight_kg')
    .eq('company_id', ctx.companyId)
    .eq('contact_id', contactId)
    .maybeSingle<{ target_weight_kg: number | string | null }>();

  if (!before) return { ok: false, error: 'no_intake' };

  const { error } = await sb
    .from('client_intake')
    .update({ target_weight_kg: targetWeightKg })
    .eq('company_id', ctx.companyId)
    .eq('contact_id', contactId);

  if (error) {
    console.error('setWeightGoalAction:', error.message);
    return { ok: false, error: 'write_failed' };
  }

  logCoachAction(sb, {
    companyId: ctx.companyId,
    userId: ctx.userId,
    entityType: 'client_intake',
    entityId: contactId,
    action: 'client.weight_goal_set',
    previousState: { target_weight_kg: before.target_weight_kg },
    newState: { target_weight_kg: targetWeightKg },
  });

  revalidatePath(`/coach/clients/${contactId}`);
  return { ok: true, targetWeightKg };
}
