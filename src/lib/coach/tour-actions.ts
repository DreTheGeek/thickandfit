'use server';

import { requireCoach } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { ONBOARDING } from '@/lib/coach/onboarding';
import { revalidatePath } from 'next/cache';

/**
 * Tick a Getting started stage BY HAND.
 *
 * Only stages with `derivedFrom: null` can be ticked this way, and the allowlist is derived from
 * the catalog itself rather than written out again here. A stage the database can prove is never
 * tickable: she assigns a program, the row exists, the tick follows. Accepting a manual tick for
 * one of those would let the checklist disagree with the data it is reading, and the checklist
 * would be the one that is wrong.
 *
 * This is also why it is safe for the key to arrive from the client at all. The comment on
 * markCoachStepAction above is about ACTION steps, which must not be fakeable; these are the ones
 * that are explicitly hers to declare, because nothing in the schema can answer them.
 */
export async function markOnboardingStepAction(formData: FormData): Promise<void> {
  const key = String(formData.get('step') ?? '');
  const selfReported = new Set(ONBOARDING.filter((s) => s.derivedFrom === null).map((s) => s.key));
  if (!selfReported.has(key)) return;

  try {
    const ctx = await requireCoach();
    if (!ctx.companyId) return;
    await createServiceClient()
      .from('coach_checklist')
      .upsert(
        { company_id: ctx.companyId, profile_id: ctx.userId, step_key: key },
        { onConflict: 'profile_id,step_key', ignoreDuplicates: true },
      );
    revalidatePath('/coach/getting-started');
    revalidatePath('/coach');
  } catch {
    // Same reasoning as above: a checklist that cannot write stays unticked, which is annoying. A
    // checklist that throws takes down the console it is teaching, which is not.
  }
}
