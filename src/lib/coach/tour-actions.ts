'use server';

import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { stepForPath } from '@/lib/coach/tour';

/**
 * Record that this coach has seen a screen.
 *
 * Called from the tracker on navigation, so it must be cheap, idempotent, and completely silent on
 * failure. A checklist that cannot write stays unticked, which is annoying. A checklist that throws
 * takes down the console it is teaching, which is not.
 *
 * The PATH is passed rather than the step key, and resolved server-side. The client does not get to
 * name which box to tick: that would let anyone mark the whole tour done with one fetch, and the
 * point of an action step is that it cannot be faked.
 */
export async function markCoachStepAction(pathname: string): Promise<void> {
  try {
    const ctx = await requireCoach();
    if (!ctx.companyId) return;
    const key = stepForPath(pathname);
    if (!key) return;

    await createServiceClient()
      .from('coach_checklist')
      // First completion wins, and re-visiting must not churn the row. The primary key on
      // (profile_id, step_key) does the deduping.
      .upsert(
        { company_id: ctx.companyId, profile_id: ctx.userId, step_key: key },
        { onConflict: 'profile_id,step_key', ignoreDuplicates: true },
      );
  } catch {
    // Deliberately swallowed. See above.
  }
}
