'use server';

// Set the member's goal type (what the You screen leads with). Writes onboarding_responses.goal_type
// for the caller; RLS + the profile_id filter scope it to them. A gentle member cannot select
// lose_weight, enforced here as well as in the UI so the posture cannot be bypassed by a crafted call.
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { prefersGentleFraming } from '@/lib/health-profile/screening';
import { isGoalType, type GoalType } from '@/lib/goals/goal-type';

export type GoalTypeResult = { ok: boolean; error?: 'invalid' | 'blocked' | 'save_failed' };

export async function setGoalTypeAction(input: unknown): Promise<GoalTypeResult> {
  if (!isGoalType(input)) return { ok: false, error: 'invalid' };
  const goalType: GoalType = input;

  const ctx = await requireAuth();
  if (goalType === 'lose_weight' && ctx.companyId) {
    const gentle = await prefersGentleFraming(ctx.userId, ctx.companyId);
    if (gentle) return { ok: false, error: 'blocked' };
  }

  const sb = await createClient();
  const { error } = await sb
    .from('onboarding_responses')
    .update({ goal_type: goalType })
    .eq('profile_id', ctx.userId);
  if (error) {
    console.error('setGoalTypeAction:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  revalidatePath('/you');
  return { ok: true };
}
